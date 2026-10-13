// Additional Northstar experiences. All member/admin actions are checked again by the server.
export function createFeaturesUI({api,escapeHtml,getUser,navigate,onAccountDeleted}){
 const e=value=>escapeHtml(value??'');
 const node=id=>document.getElementById(id);
 const feedback=(id,message,bad=false)=>{const target=node(id);if(target){target.textContent=message;target.className=`form-message ${bad?'error':'success'}`;}};
 let questions=[],selectedAdminUser=null,userPage=1,userSearch='';

 function section(path){
  if(path==='/')return `<section class="section daily-highlight"><div class="container"><div class="section-top"><div><div class="eyebrow">A FRESH DISCOVERY</div><h2>Object of the day</h2></div></div><div id="ns-featured-object" role="status">Choosing today's object…</div></div></section>`;
  if(path==='/quiz')return `<section class="section"><div class="container narrow"><div class="eyebrow">A SMALL CHALLENGE</div><h1>Museum Quiz</h1><p>Three questions about the Northstar collection. Read the objects' stories to find the answers.</p>${getUser()?'<div id="ns-quiz">Loading questions…</div>':'<p><a data-link class="btn btn-primary" href="/login">Log in to play and save your score</a></p>'}</div></section>`;
  if(path==='/mysteries')return `<section class="section alt"><div class="container feature-shell"><div class="eyebrow">THE SEVEN CLUES</div><h2>The Secret Archive</h2><p>Find all seven secrets in the collection to unlock the first curator's last letter and earn a special title.</p><div class="feature-actions"><a class="btn btn-outline" data-link href="/quiz">Try the museum quiz</a><a class="btn btn-primary" data-link href="/secret-archive">Enter the Secret Archive →</a></div></div></section>`;
  if(path==='/secret-archive')return `<section class="section"><div class="container narrow"><a data-link href="/mysteries" class="subtle-link">← Back to mysteries</a><div class="eyebrow">THE MISSING CURATOR · 1894</div><h1>The Secret Archive</h1><div id="ns-secret-finale" role="status">Checking your discovery progress…</div></div></section>`;
  if(path==='/account'&&getUser())return `<section class="section alt"><div class="container feature-shell"><div class="eyebrow">YOUR OWN MUSEUM</div><h2>Personal collections</h2><p>Make lists of objects you want to remember. You can organize objects you saved in your visit planner.</p><form id="ns-collection-create" class="feature-inline"><label>New collection name <input name="name" minlength="2" maxlength="60" required placeholder="My favourite objects"></label><button class="btn btn-primary">Create collection</button></form><p id="ns-collections-feedback" role="status"></p><div id="ns-member-collections">Loading collections…</div><div class="feature-divider"></div><h2>Your account data</h2><p>You can download a JSON copy of your profile, bookings, likes, reviews, quiz scores and collections. Your password is never included.</p><button type="button" class="btn btn-outline" data-ns-export>Download my data</button><p id="ns-export-feedback" role="status"></p><div class="feature-divider"></div><section class="feature-danger"><h2>Delete account</h2><p>This is permanent. Your bookings, stamps, saved objects, collections and reviews will be removed.</p>${getUser().role==='admin'?'<p>Administrator accounts cannot be removed from this page.</p>':`<form id="ns-account-delete"><label>Type <strong>DELETE ACCOUNT</strong> to confirm <input name="confirmation" data-ns-confirm="self" autocomplete="off" spellcheck="false" placeholder="DELETE ACCOUNT" required></label><label>Your current password <input type="password" name="password" autocomplete="current-password" required></label><button type="submit" class="btn btn-danger" id="ns-self-delete-button" disabled>Delete my account permanently</button><p role="status" id="ns-account-delete-feedback"></p></form>`}</section></div></section>`;
  if(path==='/admin'&&getUser()?.role==='admin')return `<section class="section"><div class="container feature-shell"><div class="eyebrow">ACCOUNT MANAGEMENT</div><h2>Visitor accounts</h2><p>Search members and manage account removal. Only visitor accounts can be deleted.</p><form id="ns-admin-search" class="feature-inline"><label>Search by name or email <input name="search" type="search" maxlength="80" placeholder="Name or email"></label><button class="btn btn-outline">Search</button></form><p id="ns-admin-actions-feedback" role="status"></p><div id="ns-admin-users">Loading visitors…</div><div id="ns-admin-target"></div><div class="feature-divider"></div><h2>Recent admin activity</h2><p class="muted">A record of administrator content changes, review moderation, check-ins and deleted accounts.</p><div id="ns-admin-log">Loading activity…</div></div></section>`;
  return '';
 }

 async function loadedPage(path){
  if(path==='/'){
   try{const {date,artifact}=await api('/api/artifact-of-day');const el=node('ns-featured-object');if(!el)return;
    el.innerHTML=artifact?`<article class="feature-daily-card"><img loading="lazy" src="/assets/artifacts/${e(artifact.imageKey)}.webp" alt="Concept artwork for ${e(artifact.title)}"><div><span class="eyebrow">${e(date)} · ${e(artifact.category)}</span><h3>${e(artifact.title)}</h3><p>${e(artifact.summary)}</p><a data-link class="btn btn-outline" href="/artifacts/${Number(artifact.id)}">Read its story →</a></div></article>`:'<p>No featured object is available today.</p>';
   }catch{if(node('ns-featured-object'))node('ns-featured-object').textContent='The daily object is unavailable.';}
  }
  if(path==='/quiz'&&getUser()){
   try{({questions}=await api('/api/quiz'));const el=node('ns-quiz');if(!el)return;
    el.innerHTML=`<form id="ns-quiz-form">${questions.map((q,i)=>`<fieldset class="quiz-question"><legend><strong>${i+1}. ${e(q.question)}</strong></legend>${q.choices.map((choice,ix)=>`<label><input type="radio" name="question${i}" value="${ix}" required> ${e(choice)}</label>`).join('')}</fieldset>`).join('')}<button class="btn btn-primary">Check answers</button><p id="ns-quiz-feedback" role="status"></p></form>`;
   }catch(err){if(node('ns-quiz'))node('ns-quiz').textContent=err.message;}
  }
  if(path==='/secret-archive'){
   const el=node('ns-secret-finale');if(!el)return;
   if(!getUser()){el.innerHTML='<p>Create an account and find all seven clues to enter.</p><a data-link class="btn btn-primary" href="/login">Log in</a>';return;}
   try{const result=await api('/api/account/mystery/finale');if(!node('ns-secret-finale'))return;
    node('ns-secret-finale').innerHTML=`<article class="finale-letter"><div class="eyebrow">1894 · THE FINAL LETTER</div><h2>${e(result.title)}</h2><p class="finale-body">${e(result.letter)}</p><p><strong>Unlocked title: ${e(result.reward)}</strong></p></article>`;
   }catch(err){if(node('ns-secret-finale'))node('ns-secret-finale').innerHTML=`<p>${e(err.message)}</p><a data-link class="btn btn-outline" href="/collection">Continue searching →</a>`;}
  }
  if(path==='/account'&&getUser())await loadCollections();
  if(path==='/admin'&&getUser()?.role==='admin')await Promise.all([loadUsers(),loadActivity()]);
 }

 async function loadCollections(){
  try{
   const [{collections},{saved}]=await Promise.all([api('/api/account/collections'),api('/api/account/museum')]);
   const el=node('ns-member-collections');if(!el)return;
   el.innerHTML=collections.length?collections.map(c=>`<article class="feature-collection"><div class="feature-card-top"><h3>${e(c.name)}</h3><button class="btn btn-small btn-outline" data-ns-remove-collection="${c.id}" type="button">Remove list</button></div><form id="ns-collection-rename-${c.id}" class="feature-inline" data-ns-collection-rename="${c.id}"><label>Rename <input name="name" value="${e(c.name)}" required minlength="2" maxlength="60"></label><button class="btn btn-small btn-outline">Save name</button></form><div class="feature-mini-list">${c.artifacts.length?c.artifacts.map(a=>`<div class="feature-mini-row"><a data-link href="/artifacts/${a.id}">${e(a.title)}</a><button type="button" data-ns-remove-item="${c.id}:${a.id}" class="text-button">Remove</button></div>`).join(''):'<p class="muted">No objects added yet.</p>'}</div>${saved.length?`<form class="feature-inline" data-ns-add-item="${c.id}"><label>Add from saved objects <select name="artifactId">${saved.filter(a=>!c.artifacts.some(x=>x.id===a.id)).map(a=>`<option value="${a.id}">${e(a.title)}</option>`).join('')||'<option value="">Nothing new to add</option>'}</select></label><button class="btn btn-small btn-outline" ${saved.every(a=>c.artifacts.some(x=>x.id===a.id))?'disabled':''}>Add object</button></form>`:'<p class="muted">Save an object in the collection first.</p>'}</article>`).join(''):'<p class="empty-state">You have no personal collections. Create your first one above.</p>';
  }catch(err){if(node('ns-member-collections'))node('ns-member-collections').textContent=err.message;}
 }

 async function loadUsers(search=userSearch){
  try{userSearch=search;const {users,total}=await api('/api/admin/users?search='+encodeURIComponent(search)+'&page='+userPage);const el=node('ns-admin-users');if(!el)return;
   el.innerHTML=`<p class="muted">${total} account(s) found. Showing up to 20.</p><div class="table-scroll"><table class="museum-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead><tbody>${users.map(u=>`<tr><td>${e(u.name)}</td><td>${e(u.email)}</td><td>${e(u.role)}</td><td>${u.role==='visitor'?`<button type="button" class="btn btn-small btn-outline" data-ns-select-user="${u.id}">Manage</button>`:'Not available'}</td></tr>`).join('')||'<tr><td colspan="4">No accounts found.</td></tr>'}</tbody></table></div><div class="feature-actions"><button type="button" class="btn btn-small btn-outline" data-ns-user-page="previous" ${userPage<=1?'disabled':''}>Previous</button><span>Page ${userPage} of ${Math.max(1,Math.ceil(total/20))}</span><button type="button" class="btn btn-small btn-outline" data-ns-user-page="next" ${userPage>=Math.ceil(total/20)?'disabled':''}>Next</button></div>`;
   el._users=users;
  }catch(err){if(node('ns-admin-users'))node('ns-admin-users').textContent=err.message;}
 }
 async function loadActivity(){
  try{const {entries}=await api('/api/admin/activity');const el=node('ns-admin-log');if(!el)return;
   el.innerHTML=entries.length?`<div class="table-scroll"><table class="museum-table"><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Record</th></tr></thead><tbody>${entries.map(a=>`<tr><td>${e(a.createdAt)}</td><td>${e(a.actor)}</td><td>${e(a.action.replaceAll('_',' '))}</td><td>${e(a.targetType)} ${a.targetId??''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No admin actions recorded yet.</p>';
  }catch(err){if(node('ns-admin-log'))node('ns-admin-log').textContent=err.message;}
 }
 function renderTarget(){const root=node('ns-admin-target');if(!root)return;if(!selectedAdminUser){root.innerHTML='';return;}
  root.innerHTML=`<section class="feature-danger"><h3>Delete visitor: ${e(selectedAdminUser.name)}</h3><p><strong>${e(selectedAdminUser.email)}</strong> · User ID ${selectedAdminUser.id}</p><p>This permanently deletes the account and all personal bookings and collections.</p><form id="ns-admin-delete-form"><label>Type <strong>DELETE ACCOUNT</strong> <input name="confirmation" data-ns-confirm="admin" autocomplete="off" spellcheck="false" placeholder="DELETE ACCOUNT" required></label><label>Your administrator password <input type="password" name="password" autocomplete="current-password" required></label><button class="btn btn-danger" id="ns-admin-delete-button" disabled>Delete this visitor permanently</button><button type="button" class="btn btn-outline" data-ns-cancel-user>Cancel</button><p id="ns-admin-delete-feedback" role="status"></p></form></section>`;
 }

 async function click(button){
  if(button.hasAttribute('data-ns-export')){
   try{const data=await api('/api/account/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='northstar-my-data.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('ns-export-feedback','Your data file is ready.');}catch(err){feedback('ns-export-feedback',err.message,true);}return true;
  }
  if(button.dataset.nsUserPage){userPage+=button.dataset.nsUserPage==='next'?1:-1;await loadUsers();return true;}
  if(button.dataset.nsSelectUser){const id=Number(button.dataset.nsSelectUser);selectedAdminUser=node('ns-admin-users')?._users?.find(u=>u.id===id&&u.role==='visitor')||null;renderTarget();node('ns-admin-target')?.scrollIntoView({block:'nearest'});return true;}
  if(button.hasAttribute('data-ns-cancel-user')){selectedAdminUser=null;renderTarget();return true;}
  if(button.dataset.nsRemoveCollection){if(!window.confirm('Delete this collection list? The objects will stay in Northstar.'))return true;try{await api(`/api/account/collections/${Number(button.dataset.nsRemoveCollection)}`,{method:'DELETE'});await loadCollections();}catch(err){feedback('ns-collections-feedback',err.message,true);}return true;}
  if(button.dataset.nsRemoveItem){const [c,a]=button.dataset.nsRemoveItem.split(':').map(Number);try{await api(`/api/account/collections/${c}/artifacts/${a}`,{method:'DELETE'});await loadCollections();}catch(err){feedback('ns-collections-feedback',err.message,true);}return true;}
  return false;
 }
 async function submit(form){
  try{
   if(form.id==='ns-quiz-form'){
    const answers=questions.map((_,i)=>Number(new FormData(form).get(`question${i}`)));
    if(questions.some((_,i)=>!new FormData(form).has(`question${i}`)))throw new Error('Please answer all questions.');
    const result=await api('/api/account/quiz',{method:'POST',body:JSON.stringify({answers})});
    feedback('ns-quiz-feedback',`Score: ${result.score}/${result.total}. ${result.clue||'Explore the collection to learn more.'}`);return true;
   }
   if(form.id==='ns-collection-create'){const name=new FormData(form).get('name');await api('/api/account/collections',{method:'POST',body:JSON.stringify({name})});form.reset();feedback('ns-collections-feedback','Collection created.');await loadCollections();return true;}
   if(form.dataset.nsCollectionRename){const name=new FormData(form).get('name');await api(`/api/account/collections/${Number(form.dataset.nsCollectionRename)}`,{method:'PUT',body:JSON.stringify({name})});feedback('ns-collections-feedback','Collection renamed.');await loadCollections();return true;}
   if(form.dataset.nsAddItem){const artifactId=Number(new FormData(form).get('artifactId'));if(!artifactId)throw new Error('Choose an object to add.');await api(`/api/account/collections/${Number(form.dataset.nsAddItem)}/artifacts/${artifactId}`,{method:'POST',body:'{}'});await loadCollections();return true;}
   if(form.id==='ns-admin-search'){selectedAdminUser=null;userPage=1;renderTarget();await loadUsers(new FormData(form).get('search'));return true;}
   if(form.id==='ns-account-delete'){
    const data=Object.fromEntries(new FormData(form));if(data.confirmation!=='DELETE ACCOUNT')throw new Error('Type DELETE ACCOUNT exactly.');
    await api('/api/account',{method:'DELETE',body:JSON.stringify(data)});await onAccountDeleted();return true;
   }
   if(form.id==='ns-admin-delete-form'){
    if(!selectedAdminUser)throw new Error('Select a visitor first.');const data=Object.fromEntries(new FormData(form));
    if(data.confirmation!=='DELETE ACCOUNT')throw new Error('Type DELETE ACCOUNT exactly.');
    await api(`/api/admin/users/${selectedAdminUser.id}`,{method:'DELETE',body:JSON.stringify(data)});
    selectedAdminUser=null;renderTarget();await Promise.all([loadUsers(),loadActivity()]);feedback('ns-admin-actions-feedback','Visitor account deleted.');return true;
   }
  }catch(err){const id=form.id==='ns-account-delete'?'ns-account-delete-feedback':form.id==='ns-admin-delete-form'?'ns-admin-delete-feedback':form.id==='ns-quiz-form'?'ns-quiz-feedback':'ns-collections-feedback';feedback(id,err.message,true);return true;}
  return false;
 }
 function input(target){
  if(target.dataset.nsConfirm==='self'&&node('ns-self-delete-button'))node('ns-self-delete-button').disabled=target.value!=='DELETE ACCOUNT';
  if(target.dataset.nsConfirm==='admin'&&node('ns-admin-delete-button'))node('ns-admin-delete-button').disabled=target.value!=='DELETE ACCOUNT';
 }
 return {section,loadedPage,click,submit,input};
}
