const {randomUUID}=require('node:crypto');
function sharingDrive({restrictEditFiles=false}={}){
  const files=new Map(),requests=[],permissions=[],comments=new Map(),revisions=new Map();
  let sequence=0,failAfterCommit=false,failCommentAfterCommit=false;
  const actors={owner:'owner@example.test',editor:'editor@example.test',outsider:'outsider@example.test'};
  function can(file,actor){return file&&(file.owner===actor||file.grants?.[actors[actor]]==='writer'||file.parents?.some(id=>files.get(id)?.owner===actor||files.get(id)?.grants?.[actors[actor]]==='writer'));}
  function visible(file,actor){return can(file,actor)&&(!restrictEditFiles||file.appProperties?.windsNotesSharedEdit!=='1'||file.owner===actor);}
  function metadata(file,actor){const {content,grants,...meta}=file;return {...meta,capabilities:{canEdit:can(file,actor),canShare:file.owner===actor}};}
  function revision(file,keepForever){
    const id='revision-'+randomUUID();
    const history=revisions.get(file.id)||[];
    history.push({id,keepForever,modifiedTime:file.modifiedTime,content:structuredClone(file.content)});
    revisions.set(file.id,history);file.headRevisionId=id;
  }
  return {files,requests,permissions,comments,revisions,actors,
    failUploadAfterCommit(){failAfterCommit=true;},
    failJournalAfterCommit(){failCommentAfterCommit=true;},
    async fetch(url,options={}){
      const target=new URL(url),headers=new Headers(options.headers||{}),actor=(headers.get('Authorization')||'Bearer token-outsider').replace('Bearer token-','');
      requests.push({url,method:options.method||'GET',actor});
      const id=target.pathname.match(/\/files\/([^/]+)/)?.[1],file=files.get(id);
      if(target.pathname.includes('/upload/')){
        if(target.searchParams.get('uploadType')==='media'&&options.method==='PATCH'){
          if(!visible(file,actor))return Response.json({error:{message:'Access denied'}},{status:403});
          file.content=JSON.parse(await options.body.text());
          file.modifiedTime=new Date(Date.UTC(2026,10,4,12,0,sequence++)).toISOString();
          revision(file,target.searchParams.get('keepRevisionForever')==='true');
          if(failAfterCommit){failAfterCommit=false;throw Error('Connection lost after Drive accepted the upload');}
          return Response.json({id:file.id,headRevisionId:file.headRevisionId});
        }
        const text=await options.body.text(),parts=text.split('\r\n\r\n');
        const meta=JSON.parse(parts[1].split('\r\n--')[0]),content=JSON.parse(parts[2].split('\r\n--')[0]);
        const parent=files.get(meta.parents?.[0]);
        if((meta.parents&&!can(parent,actor))||(id&&!can(file,actor)))return Response.json({error:{message:'Access denied'}},{status:403});
        const at=new Date(Date.UTC(2026,10,4,12,0,sequence++)).toISOString();
        const created={...file,...meta,id:file?.id||'file-'+randomUUID(),owner:file?.owner||actor,createdTime:file?.createdTime||at,modifiedTime:at,content};files.set(created.id,created);
        revision(created,false);
        if(failAfterCommit){failAfterCommit=false;throw Error('Connection lost after Drive accepted the upload');}
        return Response.json({id:created.id});
      }
      if(target.pathname.endsWith('/permissions')){
        if(!file||file.owner!==actor)return Response.json({error:{message:'Only owner can share'}},{status:403});
        const permission=JSON.parse(options.body);file.grants[permission.emailAddress]=permission.role;permissions.push({fileId:id,...permission});return Response.json({id:'permission-'+permissions.length});
      }
      if(target.pathname.endsWith('/comments')){
        if(!visible(file,actor))return Response.json({error:{message:'Access denied'}},{status:404});
        const journal=comments.get(id)||[];
        if(options.method==='POST'){
          const at=new Date(Date.UTC(2026,10,4,12,0,sequence++)).toISOString();
          const record={id:randomUUID(),modifiedTime:at,...JSON.parse(options.body)};
          journal.push(record);comments.set(id,journal);
          if(failCommentAfterCommit){failCommentAfterCommit=false;throw Error('Connection lost after Drive saved the edit log record');}
          return Response.json({id:record.id});
        }
        const start=target.searchParams.get('startModifiedTime')||'';
        return Response.json({comments:journal.filter(record=>record.modifiedTime>=start)});
      }
      if(target.pathname.includes('/revisions')){
        if(!visible(file,actor))return Response.json({error:{message:'Access denied'}},{status:404});
        const history=revisions.get(id)||[];
        const revisionId=target.pathname.match(/\/revisions\/([^/]+)/)?.[1];
        if(!revisionId)return Response.json({revisions:history.map(({content,...meta})=>meta)});
        const index=history.findIndex(record=>record.id===revisionId);
        if(index<0)return Response.json({error:{message:'Revision not found'}},{status:404});
        if(options.method==='DELETE'){
          if(file.headRevisionId===revisionId)return Response.json({error:{message:'Cannot delete the head revision'}},{status:403});
          history.splice(index,1);
          return new Response(null,{status:204});
        }
        return Response.json(history[index].content);
      }
      if(options.method==='POST'){
        const meta=JSON.parse(options.body),created={...meta,id:'folder-'+randomUUID(),owner:actor,grants:{},createdTime:new Date(Date.UTC(2026,10,4,12,0,sequence++)).toISOString()};files.set(created.id,created);return Response.json(metadata(created,actor));
      }
      if(id){
        if(!visible(file,actor))return Response.json({error:{message:'Access denied'}},{status:404});
        if(options.method==='PATCH'){if(file.owner!==actor)return Response.json({error:{message:'Access denied'}},{status:403});Object.assign(file,JSON.parse(options.body));}
        if(target.searchParams.get('alt')==='media')return Response.json(file.content);
        return Response.json({...metadata(file,actor),capabilities:{canEdit:true,canShare:file.owner===actor}});
      }
      const query=target.searchParams.get('q')||'',parent=query.match(/'([^']+)' in parents/)?.[1];
      const props=[...query.matchAll(/appProperties has \{key='([^']+)' and value='([^']+)'\}/g)];
      const found=[...files.values()].filter(item=>{
        return visible(item,actor)&&(parent?item.parents?.includes(parent):(!props.length||props.some(p=>item.appProperties?.[p[1]]===p[2])));
      });
      return Response.json({files:found.map(item=>metadata(item,actor))});
    }
  };
}
module.exports={sharingDrive};
