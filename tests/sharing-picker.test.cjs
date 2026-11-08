const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../cloud-drive.js'),'utf8'),helper=source.slice(source.indexOf('  let pickerLoader='),source.indexOf('  async function getProfile('));
function setup(key='public-test-key'){
  let callback,disposed=0,selectedId,visible,scopeProject,usedToken;const context={WINDS_GOOGLE_PICKER_API_KEY:key,WINDS_GOOGLE_CLIENT_ID:'123456-test.apps.googleusercontent.com',token:'synthetic-access-token',generation:1,location:{origin:'https://notes.example.test'},ensureIdle(version){if(version!==context.generation)throw Error('Account changed');}};context.global=context;
  class View{setMode(){return this;}setIncludeFolders(){return this;}setSelectFolderEnabled(){return this;}setFileIds(id){selectedId=id;return this;}setParent(){return this;}setMimeTypes(){return this;}setOwnedByMe(){return this;}}
  class Builder{addView(){return this;}setAppId(id){scopeProject=id;return this;}setDeveloperKey(){return this;}setOAuthToken(token){usedToken=token;return this;}setOrigin(){return this;}setTitle(){return this;}setCallback(fn){callback=fn;return this;}build(){return {dispose(){disposed++;},setVisible(value){visible=value;}};}}
  context.google={picker:{DocsView:View,DocsViewMode:{LIST:'list'},PickerBuilder:Builder,ViewId:{DOCS:'docs'},Action:{CANCEL:'cancel',PICKED:'picked',ERROR:'error'}}};context.gapi={load:(name,options)=>options.callback()};vm.runInNewContext(helper,context);
  return {context,get callback(){return callback;},get disposed(){return disposed;},get info(){return {selectedId,visible,scopeProject,usedToken};}};
}
test('shared file picker requires project configuration and requests only the intended resource',async()=>{
  await assert.rejects(setup('').context.authorizeSharedAccess('folder-test',{version:1}),/public Google Picker API key/);
  const c=setup(),work=c.context.authorizeSharedAccess('folder-test',{version:1});await Promise.resolve();await Promise.resolve();
  assert.deepEqual(c.info,{selectedId:'folder-test',visible:true,scopeProject:'123456',usedToken:'synthetic-access-token'});c.callback({action:'picked',docs:[{id:'folder-test'}]});assert.equal(await work,true);assert.equal(c.disposed,1);
});
test('picker rejects another resource and cannot complete after account change',async()=>{
  for(const change of ['file','account']){const c=setup(),work=c.context.authorizeSharedAccess('folder-test',{version:1});await Promise.resolve();await Promise.resolve();if(change==='account')c.context.generation=2;c.callback({action:'picked',docs:[{id:change==='file'?'different-file':'folder-test'}]});await assert.rejects(work,change==='account'?/Account changed/:/Select the notebook/);assert.equal(c.disposed,1);}
});
test('picker cancellation disposes the UI without granting success',async()=>{
  const c=setup(),work=c.context.authorizeSharedAccess('folder-test',{version:1});await Promise.resolve();await Promise.resolve();c.callback({action:'cancel'});assert.equal(await work,false);assert.equal(c.disposed,1);
});
test('Drive browsing returns the selected ID without requiring an invitation ID',async()=>{
  const c=setup(),work=c.context.authorizeSharedAccess(null,{version:1});await Promise.resolve();await Promise.resolve();
  assert.equal(c.info.selectedId,undefined);
  c.callback({action:'picked',docs:[{id:'shared-folder'}]});assert.equal(await work,'shared-folder');
});
test('picker reports a failed Drive grant instead of treating the selection as authorized',async()=>{
  const c=setup(),work=c.context.authorizeSharedAccess('folder-test',{version:1});await Promise.resolve();await Promise.resolve();
  c.callback({action:'picked',docs:[{id:'folder-test',driveSuccess:false,driveError:'appNotAuthorizedToFile'}]});
  await assert.rejects(work,/could not give WiNDS Notes access.*appNotAuthorizedToFile/);
  assert.equal(c.disposed,1);
});
