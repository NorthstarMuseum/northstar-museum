// Student project activities: public comparisons/timeline and private mini-exhibitions.
export function createStudentUI({api,escapeHtml,getUser}){
 const e=v=>escapeHtml(v??'');
 const node=id=>document.getElementById(id);
 let artifacts=[],miniExhibitions=[],editing=null;
 const img=a=>`/assets/artifacts/${/^[a-z-]{1,35}$/.test(a.imageKey)?a.imageKey:'compass'}.webp`;
 const notice=(message,error=false)=>{const el=node('ns-student-feedback');if(el){el.textContent=message;el.className=`form-message ${error?'error':'success'}`;}};
 const artifactCard=a=>`<article class="student-artifact"><img src="${img(a)}" alt="Concept illustration of ${e(a.title)}" loading="lazy"><div><span class="eyebrow">${e(a.category)}</span><h3>${e(a.title)}</h3><p>${e(a.summary)}</p><a href="/artifacts/${a.id}" data-link>Read its story →</a></div></article>`;
 function section(path){
  if(path==='/compare')return `<section class="section"><div class="container feature-shell"><div class="eyebrow">LOOK MORE CLOSELY</div><h1>Compare two objects.</h1><p>Pick two objects and explore their differences. Every object is fictional.</p><form class="student-compare-form" id="ns-compare-form"><label>First object<select name="first" id="ns-first" required></select></label><label>Second object<select name="second" id="ns-second" required></select></label><button class="btn btn-primary">Compare objects</button></form><p id="ns-student-feedback" role="status"></p><div id="ns-compare-results" class="student-compare-grid" aria-live="polite"></div></div></section>`;
  if(path==='/timeline')return `<section class="section"><div class="container feature-shell"><div class="eyebrow">FICTIONAL ARCHIVE · CLASS PROJECT</div><h1>The Northstar timeline.</h1><p>Explore the imaginary history of our museum. These years and events were written for this student project.</p><div id="ns-timeline" class="student-timeline" aria-live="polite"><p>Loading our fictional history…</p></div></div></section>`;
  if(path==='/my-exhibitions')return `<section class="section"><div class="container feature-shell"><div class="eyebrow">MEMBER ACTIVITY</div><h1>Create your own exhibition.</h1><p>Choose 3 to 6 fictional objects, give your exhibition a name and explain why you chose them. Your exhibitions are private to your account.</p>${getUser()?'<div id="ns-mini-editor"></div><p id="ns-student-feedback" role="status"></p><h2>My mini-exhibitions</h2><div id="ns-mini-list" aria-live="polite">Loading…</div>':'<p><a data-link class="btn btn-primary" href="/login">Log in to create an exhibition</a></p>'}</div></section>`;
  if(path==='/collection')return `<section class="section alt"><div class="container"><div class="section-top"><div><div class="eyebrow">EXPLORE FURTHER</div><h2>See the collection differently.</h2><p>Compare objects or explore our made-up museum history.</p></div></div><div class="student-link-grid"><a data-link class="student-link-card" href="/compare"><strong>Compare objects</strong><span>Choose two artifacts and explore their stories →</span></a><a data-link class="student-link-card" href="/timeline"><strong>Northstar timeline</strong><span>Discover a fictional history of the archive →</span></a><a data-link class="student-link-card" href="/my-exhibitions"><strong>Make a mini-exhibition</strong><span>Curate your own group of objects →</span></a></div></div></section>`;
  if(path==='/account'&&getUser())return `<section class="section alt"><div class="container feature-shell"><div class="eyebrow">YOUR CREATIVE WORK</div><h2>My mini-exhibitions</h2><p>Select three to six objects and build an exhibition of your own. Only you can edit it.</p><a class="btn btn-outline" data-link href="/my-exhibitions">Open exhibition creator →</a></div></section>`;
  return '';
 }
 function drawComparison(first,second){const el=node('ns-compare-results');if(!el)return;el.innerHTML=`${artifactCard(first)}${artifactCard(second)}`;}
 function renderEditor(){const el=node('ns-mini-editor');if(!el)return;
  const draft=miniExhibitions.find(x=>x.id===editing);
  el.innerHTML=`<form id="ns-mini-form" class="student-editor"><h2>${draft?'Edit':'Create'} mini-exhibition</h2><label>Exhibition title<input name="title" minlength="3" maxlength="70" required value="${e(draft?.title||'')}" placeholder="Stories of the Stars"></label><label>Short introduction<textarea name="description" rows="3" minlength="10" maxlength="250" required placeholder="Why did you choose these objects?">${e(draft?.description||'')}</textarea></label><fieldset><legend>Select 3 to 6 objects</legend><div class="student-check-grid">${artifacts.map(a=>`<label class="student-check"><input type="checkbox" name="artifactId" value="${a.id}" ${draft?.artifacts.some(x=>x.id===a.id)?'checked':''}><span>${e(a.title)}</span></label>`).join('')}</div></fieldset><div class="feature-actions"><button class="btn btn-primary">${draft?'Save changes':'Create exhibition'}</button>${draft?'<button class="btn btn-outline" type="button" data-student-cancel>Edit another time</button>':''}</div></form>`;
 }
 function drawMiniList(){const el=node('ns-mini-list');if(!el)return;
  el.innerHTML=miniExhibitions.length?miniExhibitions.map(a=>`<article class="student-mini"><div class="student-mini-head"><div><span class="eyebrow">PRIVATE MINI-EXHIBITION · ${a.artifacts.length} OBJECTS</span><h3>${e(a.title)}</h3><p>${e(a.description)}</p></div><div class="feature-actions"><button class="btn btn-small btn-outline" data-student-edit="${a.id}">Edit</button><button class="btn btn-small btn-outline" data-student-delete="${a.id}">Delete</button></div></div><div class="student-mini-items">${a.artifacts.map(x=>`<a href="/artifacts/${x.id}" data-link><img src="${img(x)}" loading="lazy" alt="Concept illustration of ${e(x.title)}"><span>${e(x.title)}</span></a>`).join('')}</div></article>`).join(''):'<p class="empty-state">No mini-exhibitions yet. Create one above.</p>';
 }
 async function loadedPage(path){
  if(path==='/compare'||path==='/my-exhibitions'&&getUser()){
   try{artifacts=(await api('/api/artifacts')).artifacts.map(a=>({id:a.id,title:a.title,category:a.category,summary:a.summary,imageKey:a.image_key??a.imageKey}));
    if(path==='/compare'){
     const options=artifacts.map(a=>`<option value="${a.id}">${e(a.title)}</option>`).join('');const a=node('ns-first'),b=node('ns-second');if(!a||!b)return;
     a.innerHTML=options;b.innerHTML=options;if(artifacts.length>1){b.selectedIndex=1;drawComparison(artifacts[0],artifacts[1]);}
    }else{miniExhibitions=(await api('/api/account/mini-exhibitions')).exhibitions;editing=null;renderEditor();drawMiniList();}
   }catch(error){notice(error.message,true);}
  }
  if(path==='/timeline'){
   try{const {entries}=await api('/api/timeline');const el=node('ns-timeline');if(!el)return;el.innerHTML=entries.map(item=>`<article class="student-era"><div class="student-year">${e(item.year)}</div><div><h2>${e(item.title)}</h2><p>${e(item.story)}</p>${item.artifact?`<a href="/artifacts/${item.artifact.id}" data-link>Explore ${e(item.artifact.title)} →</a>`:''}</div></article>`).join('');}
   catch(error){if(node('ns-timeline'))node('ns-timeline').textContent=error.message;}
  }
 }
 async function submit(form){
  try{
   if(form.id==='ns-compare-form'){
    const data=new FormData(form),first=artifacts.find(a=>a.id===Number(data.get('first'))),second=artifacts.find(a=>a.id===Number(data.get('second')));
    if(!first||!second||first.id===second.id)throw new Error('Please choose two different objects.');drawComparison(first,second);notice('Comparison ready.');return true;
   }
   if(form.id==='ns-mini-form'){
    const values=new FormData(form),artifactIds=values.getAll('artifactId').map(Number);
    if(artifactIds.length<3||artifactIds.length>6)throw new Error('Please select 3 to 6 different objects.');
    const body={title:values.get('title'),description:values.get('description'),artifactIds};
    await api(editing?`/api/account/mini-exhibitions/${editing}`:'/api/account/mini-exhibitions',{method:editing?'PUT':'POST',body:JSON.stringify(body)});
    editing=null;miniExhibitions=(await api('/api/account/mini-exhibitions')).exhibitions;renderEditor();drawMiniList();notice('Mini-exhibition saved.');return true;
   }
  }catch(error){notice(error.message,true);return true;}
  return false;
 }
 async function click(button){
  if(button.hasAttribute('data-student-cancel')){editing=null;renderEditor();notice('Editing cancelled.');return true;}
  if(button.dataset.studentEdit){editing=Number(button.dataset.studentEdit);renderEditor();node('ns-mini-editor')?.scrollIntoView({block:'start'});return true;}
  if(button.dataset.studentDelete){
   const id=Number(button.dataset.studentDelete);
   if(!window.confirm('Delete this mini-exhibition? Your objects will not be deleted.'))return true;
   try{await api(`/api/account/mini-exhibitions/${id}`,{method:'DELETE'});editing=null;miniExhibitions=(await api('/api/account/mini-exhibitions')).exhibitions;renderEditor();drawMiniList();notice('Mini-exhibition deleted.');}
   catch(error){notice(error.message,true);}return true;
  }
  return false;
 }
 return {section,loadedPage,submit,click};
}
