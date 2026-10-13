import { createMuseumUI } from './museum-ui.js';
import { createFeaturesUI } from './features-ui.js';
const state = { user: null, exhibitions: [], events: [], saved: { exhibitions: [], events: [] }, likes: { exhibitions: [], events: [] }, explore: { query:'', category:'all', order:'featured' }, returnTo: '', pendingAction: null, admin: { tab: 'exhibitions', items: { exhibitions: [], events: [], messages: [] }, draft: null }, error: '' };
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const museum = createMuseumUI({api,escapeHtml,getUser:()=>state.user,navigate,render});
const features = createFeaturesUI({api,escapeHtml,getUser:()=>state.user,navigate,onAccountDeleted:async()=>{state.user=null;state.saved={exhibitions:[],events:[]};state.likes={exhibitions:[],events:[]};await museum.loadMine();navigate('/');}});
const illustrations = Object.freeze({ stone:'stone',water:'water',light:'light',paper:'paper',shape:'shape',memory:'memory' });
const editorialImages={stone:'ancient-civilizations',water:'sky-above',light:'hidden-stories',paper:'collections',shape:'objects',memory:'gallery-rooms'};
const imageFor=key=>editorialImages[key]?`/assets/editorial/${editorialImages[key]}.webp`:`/assets/${illustrations[key]||'stone'}.svg`;
const formatDay = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA',{day:'2-digit',timeZone:'UTC'});
const formatMonth = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA',{month:'short',timeZone:'UTC'}).toUpperCase();
const formatLong = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
const currentPath = () => decodeURI(location.pathname);

async function api(path, options={}) {
  const response = await fetch(path,{credentials:'same-origin',headers:options.body ? {'Content-Type':'application/json'} : {},...options});
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function saveButton(kind,id,label) {
  const saved = state.saved[kind].some(item => item.id === id);
  return `<button type="button" class="save-button ${saved?'is-saved':''}" data-save-kind="${kind}" data-save-id="${id}" aria-pressed="${saved}" aria-label="${saved?'Remove from':'Add to'} My Northstar: ${escapeHtml(label)}">${saved?'★ Saved':'☆ Save for later'}</button>`;
}
function likeButton(kind,id,label,likeCount=0) {
  const liked = state.likes[kind].some(item => item.id === id);
  return `<button type="button" class="like-button ${liked?'is-liked':''}" data-like-kind="${kind}" data-like-id="${id}" aria-pressed="${liked}" aria-label="${liked?'Unlike':'Like'} ${escapeHtml(label)} (${likeCount} likes)"><span aria-hidden="true">${liked?'♥':'♡'}</span> ${liked?'Liked':'Like'} <span class="like-count">${likeCount}</span></button>`;
}
function exhibitionCard(item) {
  return `<article class="exhibition-card">
    <a class="exhibition-card-link" href="/exhibitions/${encodeURIComponent(item.slug)}" data-link>
    <img src="${imageFor(item.imageKey)}" alt="Conceptual gallery photography for ${escapeHtml(item.title)}" loading="lazy">
    <div class="card-content"><span class="card-kicker">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="card-tail">Discover the story <span aria-hidden="true">↗</span></div></div></a>
    <div class="card-action">${likeButton('exhibitions',item.id,item.title,item.likeCount)}${saveButton('exhibitions',item.id,item.title)}</div></article>`;
}
function eventRow(item) {
  return `<article class="event-row"><div class="event-date"><strong>${formatDay(item.date)}</strong><small>${formatMonth(item.date)}</small></div>
    <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="event-time">${formatLong(item.date)} · ${escapeHtml(item.time)} · Museum programme</div></div><div class="event-actions">${likeButton('events',item.id,item.title,item.likeCount)}${saveButton('events',item.id,item.title)}<a data-link class="round-arrow" href="/contact" aria-label="Ask about ${escapeHtml(item.title)}">↗</a></div></article>`;
}
function heading(title,intro,locationLabel=title){return `<section class="page-heading"><div class="container"><div class="bread"><a data-link href="/">HOME</a><span>/</span>${escapeHtml(locationLabel).toUpperCase()}</div><h1>${title}</h1><p>${intro}</p></div></section>`;}
function home() {
  const featured = state.exhibitions.filter(e=>e.featured).slice(0,3);
  const rows = state.events.slice(0,3);
  return `<section class="editorial-hero"><div class="container editorial-hero-grid">
    <div class="editorial-hero-copy"><div class="eyebrow">ART / HISTORY / PEOPLE</div>
      <h1>Discover stories<br>in every object</h1>
      <p>Discover remarkable objects, different cultures and the stories that connect us. There is always something new to explore at Northstar.</p>
      <div class="button-row"><a data-link href="/exhibitions" class="btn btn-primary">Explore exhibitions <span aria-hidden="true">→</span></a><a data-link href="/visit" class="btn btn-outline">Plan your visit</a></div>
    </div>
    <div class="editorial-hero-photo"><img src="/assets/editorial/museum-gallery.webp" alt="Conceptual exhibition gallery with a classical marble sculpture" fetchpriority="high"></div>
  </div></section>
  <section class="visit-information" aria-label="Visitor information"><div class="container visit-information-grid">
    <div class="visit-info"><strong>Opening days</strong><span>Tuesday–Sunday</span><a data-link href="/visit">Opening information →</a></div>
    <div class="visit-info"><strong>Plan your visit</strong><span>Choose a date and entry time</span><a data-link href="/visit">See available visits →</a></div>
    <div class="visit-info"><strong>Admission</strong><span>Reserve online · Pay at entrance</span><a data-link href="/visit">Booking details →</a></div>
  </div></section>
  ${features.section('/')}
  <section class="section exhibition-section"><div class="container"><div class="section-top"><div><div class="eyebrow">EXHIBITIONS & EVENTS</div><h2>What's on</h2></div><a data-link href="/exhibitions" class="text-link">View all exhibitions <span aria-hidden="true">→</span></a></div>
    ${featured.length?`<div class="exhibition-grid">${featured.map(exhibitionCard).join('')}</div>`:'<div class="empty-state">Our exhibitions are being prepared.</div>'}
  </div></section>
  <section class="section collection-feature"><div class="container"><div class="section-top"><div><div class="eyebrow">THE NORTHSTAR ARCHIVE</div><h2>Explore the collection</h2><p class="section-intro">A collection of imagined objects, personal stories and unexpected details.</p></div><a data-link href="/collection" class="text-link">Browse all objects <span aria-hidden="true">→</span></a></div>
  <div class="feature-grid"><a data-link class="feature-tile" href="/collection"><img src="/assets/editorial/collections.webp" alt="Classical sculpture in a fictional museum collection" loading="lazy"><div><span>THE COLLECTION</span><h3>Remarkable objects</h3><span class="feature-link">Explore objects →</span></div></a><a data-link class="feature-tile" href="/mysteries"><img src="/assets/editorial/objects.webp" alt="Antique astronomical instrument in a museum gallery" loading="lazy"><div><span>FEATURE STORY</span><h3>Hidden histories</h3><span class="feature-link">Uncover the story →</span></div></a><a data-link class="feature-tile" href="/visit"><img src="/assets/editorial/gallery-rooms.webp" alt="Painting gallery with a quiet museum interior" loading="lazy"><div><span>YOUR NORTHSTAR</span><h3>Make time to explore</h3><span class="feature-link">Plan a visit →</span></div></a></div>
  </div></section>
  <section class="section events-section"><div class="container"><div class="section-top"><div><div class="eyebrow">PROGRAMME</div><h2>Coming up</h2></div><a data-link href="/events" class="text-link">View all events →</a></div>
  ${rows.length?`<div class="events-list">${rows.map(eventRow).join('')}</div>`:'<div class="empty-state">Our event programme is being prepared.</div>'}</div></section>
  <section class="editorial-end"><div class="container editorial-end-grid"><div><span class="eyebrow">A LITTLE MORE TO DISCOVER</span><h2>Some stories are waiting to be found.</h2><p>Look more closely at seven objects across our fictional collection. Each offers a hidden fragment of the Northstar story.</p><a data-link class="text-link" href="/mysteries">Discover hidden stories →</a></div><div><span class="eyebrow">MAKE IT YOUR MUSEUM</span><h2>Your collection, your visit.</h2><p>Create an account to like objects, save favourites, reserve a visit and collect a new digital stamp after check-in.</p><a data-link class="text-link" href="/register">Create an account →</a></div></div></section>`;
}
function about(){return `${heading('A museum of <em class="highlight">possibilities.</em>','Northstar is a fictional museum created to explore how objects, ideas, and people connect.','Our story')}
  <section class="section"><div class="container intro-grid"><div><div class="eyebrow">WHY WE EXIST</div><h2>Curiosity is where every journey begins.</h2><p>We believe that the best museum experiences begin with a question. Northstar brings together art, history, science, and culture in a space designed for discovery.</p><p>Our exhibitions are imagined for this student project. They offer an accessible way to explore storytelling, thoughtful design, and the possibilities of a digital museum.</p><a data-link class="link-arrow" href="/exhibitions">Explore the collection <span aria-hidden="true">↗</span></a></div><img src="/assets/editorial/gallery-rooms.webp" alt="Paintings displayed in a fictional museum gallery"></div></section>
  <section class="section alt"><div class="container"><div class="section-top"><div><div class="eyebrow">WHAT WE VALUE</div><h2>Three ideas that <em class="highlight">guide us.</em></h2></div></div><div class="values-grid"><div class="value-card"><b>01</b><h3>Open curiosity</h3><p>Questions are welcome here. Great discoveries often begin by looking twice.</p></div><div class="value-card"><b>02</b><h3>Shared stories</h3><p>Art and objects connect people across time, geography, and experience.</p></div><div class="value-card"><b>03</b><h3>Thoughtful access</h3><p>Clear information and approachable design help more people take part.</p></div></div></div></section>`;}
function filteredExhibitions() {
  const query = state.explore.query.trim().toLowerCase();
  let rows = state.exhibitions.filter(item =>
    (state.explore.category === 'all' || state.explore.category === item.category) &&
    (!query || [item.title,item.category,item.description,item.body].some(x=>x.toLowerCase().includes(query))));
  if (state.explore.order === 'popular') rows = rows.slice().sort((a,b)=>b.likeCount-a.likeCount||a.title.localeCompare(b.title));
  else if (state.explore.order === 'az') rows = rows.slice().sort((a,b)=>a.title.localeCompare(b.title));
  return rows;
}
function exhibitionResults() {
  const rows=filteredExhibitions();
  return rows.length ? `<div class="collection-grid">${rows.map(exhibitionCard).join('')}</div>` : '<div class="empty-state">No exhibitions match your search. Try another word or category.</div>';
}
function exhibitions(){const categories=[...new Set(state.exhibitions.map(e=>e.category))].sort();return `${heading('Stories in the <em class="highlight">collection.</em>','Explore our fictional exhibitions. Give a like to the stories you enjoy, or save them to your personal list.','Exhibitions')}<section class="section"><div class="container"><div class="explore-toolbar"><div class="form-field"><label for="explore-search">Search exhibitions</label><input type="search" id="explore-search" value="${escapeHtml(state.explore.query)}" placeholder="Search titles and stories..."></div><div class="form-field"><label for="explore-category">Category</label><select id="explore-category"><option value="all">All categories</option>${categories.map(x=>`<option value="${escapeHtml(x)}" ${state.explore.category===x?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select></div><div class="form-field"><label for="explore-sort">Sort by</label><select id="explore-sort"><option value="featured" ${state.explore.order==='featured'?'selected':''}>Featured</option><option value="popular" ${state.explore.order==='popular'?'selected':''}>Most liked</option><option value="az" ${state.explore.order==='az'?'selected':''}>Title A–Z</option></select></div></div><p class="muted results-label" id="explore-count" aria-live="polite">${filteredExhibitions().length} exhibitions</p><div id="exhibition-results">${exhibitionResults()}</div></div></section>`;}
function exhibitionDetail(slug){const e=state.exhibitions.find(x=>x.slug===slug);if(!e)return notFound();return `<section class="section"><div class="container detail-layout"><img class="detail-image" src="${imageFor(e.imageKey)}" alt="Conceptual gallery photograph for ${escapeHtml(e.title)}"><div class="detail-copy"><div class="bread"><a href="/" data-link>HOME</a><span>/</span><a data-link href="/exhibitions">EXHIBITIONS</a><span>/</span>${escapeHtml(e.title).toUpperCase()}</div><div class="eyebrow" class="detail-eyebrow">${escapeHtml(e.category)}</div><h1>${escapeHtml(e.title)}</h1><p class="detail-intro">${escapeHtml(e.description)}</p><hr class="page-rule"><p>${escapeHtml(e.body).replace(/\n/g,'<br>')}</p><p class="form-hint">Northstar is a fictional museum. Illustrations and exhibitions are original concepts for this project.</p><div class="detail-actions">${likeButton('exhibitions',e.id,e.title,e.likeCount)}${saveButton('exhibitions',e.id,e.title)}</div><a data-link class="link-arrow" href="/exhibitions">← Back to all exhibitions</a></div></div></section>`;}
function events(){return `${heading('Discover what’s <em class="highlight">on.</em>','Browse talks, studios, and special programmes. The events listed here are fictional examples.','Events')}<section class="section"><div class="container"><div class="section-top"><div><div class="eyebrow">THE PROGRAMME</div><h2>Upcoming <em class="highlight">events.</em></h2></div></div>${state.events.length?`<div class="events-list">${state.events.map(eventRow).join('')}</div>`:'<div class="empty-state">No upcoming events at the moment. Check back soon.</div>'}<p class="muted" class="event-disclaimer">For project demonstration only. Visit reservations are available at Northstar. Payment is collected at the fictional museum entrance.</p></div></section>`;}
function contact(){return `${heading('We’d love to <em class="highlight">hear from you.</em>','A question about the collection or a suggestion for the site? Send us a note.','Contact')}<section class="section"><div class="container contact-layout"><div class="contact-info"><div class="eyebrow">GET IN TOUCH</div><h2>Good conversations start with <em class="highlight">curiosity.</em></h2><p>This is a fictional museum created for a college software project. We do not operate a physical gallery, and the contact form stores demonstration messages locally.</p><div class="info-line"><small>PROJECT</small><strong>Northstar Museum — student demonstration</strong></div><div class="info-line"><small>LOCATION</small><strong>Online museum concept · No public visiting address</strong></div><div class="info-line"><small>PLEASE NOTE</small><strong>Do not submit sensitive personal information.</strong></div></div><div class="contact-panel"><h2>Send a message</h2><p class="muted form-intro">Fields marked * are required.</p><form id="contact-form"><div class="form-field"><label for="contact-name">Name *</label><input id="contact-name" name="name" autocomplete="name" required minlength="2" maxlength="80"></div><div class="form-field"><label for="contact-email">Email address *</label><input id="contact-email" name="email" type="email" autocomplete="email" required maxlength="254"></div><div class="form-field"><label for="contact-message">Your message *</label><textarea id="contact-message" name="message" required minlength="10" maxlength="2500"></textarea></div><button class="btn btn-primary" type="submit">Send message ↗</button><p class="form-message" id="contact-feedback" role="status" aria-live="polite"></p></form></div></div></section>`;}
function authPage(isRegister){const title=isRegister?'Create your account':'Welcome back';return `<div class="container"><div class="auth-wrap"><div class="eyebrow">NORTHSTAR VISITOR ACCESS</div><div class="form-panel"><h1>${title}<span class="highlight">.</span></h1><p class="muted form-intro">${isRegister?'Like exhibitions and events, see all your likes in your profile, and save favourites to revisit.':'Your liked stories and saved exhibitions are waiting. Sign in to continue.'}</p><form id="auth-form" data-mode="${isRegister?'register':'login'}">${isRegister?'<div class="form-field"><label for="auth-name">Your name</label><input required minlength="2" maxlength="80" id="auth-name" name="name" autocomplete="name"></div>':''}<div class="form-field"><label for="auth-email">Email address</label><input required id="auth-email" name="email" type="email" maxlength="254" autocomplete="email"></div><div class="form-field"><label for="auth-password">Password</label><input required id="auth-password" name="password" type="password" minlength="${isRegister?'10':'1'}" maxlength="128" autocomplete="${isRegister?'new-password':'current-password'}"><div class="form-hint">${isRegister?'Use at least 10 characters.':''}</div></div>${isRegister?'<div class="form-field"><label for="auth-confirm">Confirm password</label><input required id="auth-confirm" name="confirm" type="password" autocomplete="new-password"></div>':''}<div class="check-line"><input type="checkbox" id="show-password"><label for="show-password">Show password</label></div><button class="btn btn-primary" type="submit">${isRegister?'Create account':'Log in'} <span aria-hidden="true">↗</span></button><p class="form-message" id="auth-feedback" role="alert" aria-live="polite"></p></form><p class="back-link">${isRegister?'Already have an account? <a data-link href="/login"><u>Log in</u></a>':'New to Northstar? <a data-link href="/register"><u>Create an account</u></a>'}</p></div></div></div>`;}
function account(){
  if(!state.user)return authRequired();
  const exhibits=state.saved.exhibitions;
  const events=state.saved.events;
  const likedExhibits=state.likes.exhibitions;
  const likedEvents=state.likes.events;
  return `${heading('Your <em class="highlight">Northstar.</em>','Keep your favourite exhibitions and interesting events in one place.','My account')}
    <section class="section"><div class="container"><div class="account-dashboard">
      <div class="account-card"><div class="eyebrow">YOUR PROFILE</div><h2 class="account-title">Welcome, ${escapeHtml(state.user.name)}.</h2>
        <p class="muted">Your likes and saved stories belong to this account. They stay here when you sign in again.</p>
        <dl><dt>Email address</dt><dd>${escapeHtml(state.user.email)}</dd><dt>Member type</dt><dd>${escapeHtml(state.user.role)}</dd></dl>
        <form id="profile-form" class="profile-form"><div class="form-field"><label for="profile-name">Display name</label>
        <input id="profile-name" name="name" required minlength="2" maxlength="80" value="${escapeHtml(state.user.name)}"></div>
        <button class="btn btn-outline" type="submit">Update name</button><p class="form-message" role="status" id="profile-feedback"></p></form>
        <div class="button-row account-buttons"><button class="btn btn-primary" id="logout-button" type="button">Log out ↗</button>${state.user.role==='admin'?'<a class="btn btn-outline" data-link href="/admin">Manage content</a>':''}</div>
      </div>
      <div class="account-summary"><div class="eyebrow">MY NORTHSTAR</div><h2>Your museum profile.</h2><p>Give a heart to stories you enjoy. Use Save for later when you want to return to something. Likes and saved lists are separate.</p>
      <div class="account-stats"><div><strong>${likedExhibits.length+likedEvents.length}</strong><span>things liked</span></div><div><strong>${exhibits.length}</strong><span>saved exhibitions</span></div><div><strong>${events.length}</strong><span>saved events</span></div></div><div class="profile-jump"><a href="#liked-exhibitions">My likes ↓</a><a href="#my-exhibitions">Saved items ↓</a></div></div>
    </div></div></section>
    <section class="section alt" id="liked-exhibitions"><div class="container"><div class="section-top"><div><div class="eyebrow">YOUR REACTIONS</div><h2>Exhibitions you <em class="highlight">liked.</em></h2></div><a href="/exhibitions" data-link class="link-arrow">Explore exhibitions ↗</a></div>
     ${likedExhibits.length?`<div class="collection-grid">${likedExhibits.map(exhibitionCard).join('')}</div>`:'<div class="empty-state">You have not liked any exhibitions. Select the heart on an exhibition to see it here.</div>'}</div></section>
    <section class="section" id="liked-events"><div class="container"><div class="section-top"><div><div class="eyebrow">YOUR REACTIONS</div><h2>Events you <em class="highlight">liked.</em></h2></div><a href="/events" data-link class="link-arrow">Browse events ↗</a></div>
     ${likedEvents.length?`<div class="events-list">${likedEvents.map(eventRow).join('')}</div>`:'<div class="empty-state">No liked events yet. Select the heart beside any event to add it here.</div>'}</div></section>
    <section class="section alt" id="my-exhibitions"><div class="container"><div class="section-top"><div><div class="eyebrow">YOUR READING LIST</div><h2>Saved <em class="highlight">exhibitions.</em></h2></div><a href="/exhibitions" data-link class="link-arrow">Browse exhibitions ↗</a></div>
     ${exhibits.length?`<div class="collection-grid">${exhibits.map(exhibitionCard).join('')}</div>`:'<div class="empty-state">You have not saved any exhibitions yet. Browse the collection and select “Save for later”.</div>'}</div></section>
    <section class="section" id="my-events"><div class="container"><div class="section-top"><div><div class="eyebrow">YOUR INTEREST LIST</div><h2>Saved <em class="highlight">events.</em></h2></div><a href="/events" data-link class="link-arrow">Explore events ↗</a></div>
     ${events.length?`<div class="events-list">${events.map(eventRow).join('')}</div>`:'<div class="empty-state">You have not saved any events yet. Events you save will appear here.</div>'}
     <p class="muted save-disclaimer">This is a personal interest list, not registration, booking, or an admission ticket.</p></div></section>`;
}
function authRequired(){return `${heading('Please <em class="highlight">log in.</em>','Your account is available after you sign in.')}<section class="section"><div class="container"><a class="btn btn-primary" href="/login" data-link>Log in ↗</a></div></section>`;}
function privacy(){return `${heading('Privacy <em class="highlight">information.</em>','How the Northstar student project handles the information you enter.','Privacy')}<section class="section"><div class="container narrow privacy-text"><h2>What we collect</h2><p>If you register, we store your name, email address, a password hash, your liked and saved exhibitions and events, and the dates associated with your session. If you use the contact form, we store the name, email address, and message you provide.</p><h2>Why we collect it</h2><p>Account information is used for login, the profile page, and your liked and saved items. Likes and saved items are linked to your account and can be removed. Public pages display total likes but do not identify members. Contact messages are saved so an administrator can read them. The data is stored in the project’s local SQLite database, not sent to an email provider.</p><h2>Cookies</h2><p>An essential, HttpOnly session cookie keeps you signed in for up to seven days. The project does not use marketing or tracking cookies.</p><h2>Demo limitations</h2><p>This is a college demonstration, not a production service. Avoid entering private or sensitive information. The database administrator controls stored data; registered visitors can download their account data or request permanent account deletion from My Account using their current password and the words DELETE ACCOUNT.</p><h2>Contact</h2><p>Use the <a href="/contact" data-link><u>contact form</u></a> for project-related questions. Information here describes the local demonstration, not a deployed privacy policy.</p></div></section>`;}
function notFound(){return `${heading('This page wandered <em class="highlight">off course.</em>','We could not find what you were looking for.','Not found')}<section class="section"><div class="container"><a href="/" data-link class="btn btn-primary">Return home ↗</a></div></section>`;}
function errorPage(){return `${heading('We couldn’t load the <em class="highlight">collection.</em>','Please refresh this page or try again in a moment.','Connection issue')}<section class="section"><div class="container"><button type="button" class="btn btn-primary" id="retry-button">Try again ↗</button></div></section>`;}
function adminPage(){if(!state.user)return authRequired();if(state.user.role!=='admin')return `${heading('Access <em class="highlight">restricted.</em>','The content management area is for administrators only.')}<section class="section"><div class="container"><a class="link-arrow" href="/account" data-link>Return to your account →</a></div></section>`;return `${heading('Content <em class="highlight">manager.</em>','Manage exhibitions, events, and visitor messages.','Administration')}<section class="section"><div class="container"><div id="admin-root"><p class="muted">Loading content…</p></div></div></section>`;}

function updateNav(){const nav=$('#auth-nav');if(state.user){nav.innerHTML='<a class="header-account" data-link href="/account">My account</a>';}else nav.innerHTML='<a class="header-account" data-link href="/login">Log in</a>';for(const link of document.querySelectorAll('[data-nav]')){const path=link.getAttribute('data-nav');if(path==='/' ? currentPath()==='/' : currentPath().startsWith(path))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}}
function render(){let path=currentPath();const root=$('#main');if(state.error){root.innerHTML=errorPage();return;}let content;if(path==='/')content=home();else if(path==='/about')content=about();else if(path==='/exhibitions')content=exhibitions();else if(path.startsWith('/exhibitions/'))content=exhibitionDetail(path.split('/')[2]);else if(path==='/events')content=events();else if(path==='/contact')content=contact();else if(path==='/collection'||path==='/visit'||path==='/mysteries'||path.startsWith('/artifacts/'))content=museum.page(path);else if(path==='/login')content=state.user?account()+museum.account():authPage(false);else if(path==='/register')content=state.user?account()+museum.account():authPage(true);else if(path==='/account')content=account()+museum.account();else if(path==='/admin')content=adminPage()+(state.user?.role==='admin'?museum.adminSection():'');else if(path==='/privacy')content=privacy();else if(path==='/quiz'||path==='/secret-archive')content=features.section(path);else content=notFound();root.innerHTML=content+(path==='/'||path==='/quiz'||path==='/secret-archive'?'':features.section(path));updateNav();museum.loadedPage(path);features.loadedPage(path);document.title=`${path==='/'?'Stories in every object':path.split('/')[1]?.replace(/-/g,' ')||'Northstar'} · Northstar Museum`;if(path==='/admin' && state.user?.role==='admin')loadAdmin();}
function navigate(url,replace=false){const path=new URL(url,location.origin).pathname;if(replace)history.replaceState(null,'',path);else history.pushState(null,'',path);render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('#main').focus({preventScroll:true});$('#main-nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}

async function loadLikes(){
 if (!state.user){state.likes={exhibitions:[],events:[]};return;}
 state.likes=await api('/api/account/likes');
}
async function loadSaved(){
 if (!state.user){state.saved={exhibitions:[],events:[]};return;}
 try {state.saved=await api('/api/account/saved');}
 catch(error){state.saved={exhibitions:[],events:[]};throw error;}
}
async function loadCore(){state.error='';try{const [e,v,u]=await Promise.all([api('/api/exhibitions'),api('/api/events'),api('/api/auth/me').catch(()=>({user:null}))]);state.exhibitions=e.exhibitions;state.events=v.events;state.user=u.user;await Promise.all([loadSaved(),loadLikes(),museum.loadPublic(),museum.loadMine()]);}catch{state.error='network';}render();}
function setFeedback(id,message,isError=true){const el=document.getElementById(id);if(el){el.textContent=message;el.className=`form-message ${isError?'error':'success'}`;}}

async function submitAuth(form){const data=Object.fromEntries(new FormData(form));if(form.dataset.mode==='register'&&data.password!==data.confirm){setFeedback('auth-feedback','Passwords do not match.');return;}const button=form.querySelector('button[type=submit]');button.disabled=true;try{const result=await api(`/api/auth/${form.dataset.mode}`,{method:'POST',body:JSON.stringify({name:data.name,email:data.email,password:data.password})});state.user=result.user;await Promise.all([loadSaved(),loadLikes(),museum.loadMine()]);
    if (state.pendingAction) {
      const pending=state.pendingAction;
      state.pendingAction=null;
      try {
        const endpoint=pending.action==='likes'?'likes':'saved';
        await api(`/api/account/${endpoint}/${pending.kind}/${pending.id}`,{method:'POST',body:'{}'});
        await Promise.all([loadSaved(),loadLikes(),loadPublicContent()]);
      } catch(error){window.alert(`Signed in, but the item could not be updated: ${error.message}`);}
    }
    const destination=state.returnTo||'/account';state.returnTo='';navigate(destination);}catch(err){setFeedback('auth-feedback',err.message);}finally{button.disabled=false;}}
async function submitContact(form){const data=Object.fromEntries(new FormData(form));const button=form.querySelector('button[type=submit]');button.disabled=true;try{const result=await api('/api/messages',{method:'POST',body:JSON.stringify(data)});setFeedback('contact-feedback',result.message,false);form.reset();}catch(err){setFeedback('contact-feedback',err.message);}finally{button.disabled=false;}}
async function logout(){try{await api('/api/auth/logout',{method:'POST',body:'{}'});state.user=null;await museum.loadMine();state.saved={exhibitions:[],events:[]};state.likes={exhibitions:[],events:[]};state.pendingAction=null;state.admin.items={exhibitions:[],events:[],messages:[]};navigate('/');}catch(err){window.alert(err.message);}}

async function toggleSaved(kind,id,button){
  if (!state.user){state.returnTo=currentPath();state.pendingAction={action:'saved',kind,id};navigate('/login');return;}
  if (button.disabled)return;
  const alreadySaved=state.saved[kind].some(item=>item.id===id);
  button.disabled=true;
  try {
    await api(`/api/account/saved/${kind}/${id}`,{method:alreadySaved?'DELETE':'POST',...(alreadySaved?{}:{body:'{}'})});
    await loadSaved();render();
  } catch(error){button.disabled=false;window.alert(error.message);}
}
async function toggleLiked(kind,id,button){
  if (!state.user){state.returnTo=currentPath();state.pendingAction={action:'likes',kind,id};navigate('/login');return;}
  if(button.disabled)return;
  const alreadyLiked=state.likes[kind].some(item=>item.id===id);
  button.disabled=true;
  try {
    await api(`/api/account/likes/${kind}/${id}`,{method:alreadyLiked?'DELETE':'POST',...(alreadyLiked?{}:{body:'{}'})});
    await Promise.all([loadLikes(),loadPublicContent()]);
    render();
  } catch(error){button.disabled=false;window.alert(error.message);}
}
async function saveProfile(form){
 const button=form.querySelector('button[type=submit]');button.disabled=true;
 try{const data=await api('/api/account/profile',{method:'PUT',body:JSON.stringify({name:form.elements.name.value})});state.user=data.user;
 const text=$('.account-title');if(text)text.textContent=`Welcome, ${state.user.name}.`;
 updateNav();setFeedback('profile-feedback','Display name updated.',false);
 }catch(err){setFeedback('profile-feedback',err.message);}finally{button.disabled=false;}
}
async function loadAdmin(){try{const [e,v,m]=await Promise.all([api('/api/admin/exhibitions'),api('/api/admin/events'),api('/api/admin/messages')]);state.admin.items={exhibitions:e.exhibitions,events:v.events,messages:m.messages};renderAdmin();}catch(err){if($('#admin-root'))$('#admin-root').textContent=err.message;}}
function renderAdmin(){const root=$('#admin-root');if(!root)return;const tab=state.admin.tab;const items=state.admin.items[tab]||[];let content=`<div class="admin-tabs" role="group" aria-label="Manage content">${['exhibitions','events','messages'].map(x=>`<button type="button" data-tab="${x}" class="${tab===x?'active':''}" aria-pressed="${tab===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>`;
 if(tab==='messages'){content+=items.length?items.map(x=>`<article class="admin-message"><strong>${escapeHtml(x.name)}</strong> · ${escapeHtml(x.email)} <small class="muted">${escapeHtml(x.createdAt)}</small><p>${escapeHtml(x.message)}</p></article>`).join(''):'<div class="empty-state">No messages have been submitted.</div>';}else{
 content+=`<div class="admin-top"><p class="muted">${items.length} records · unpublished records are hidden from visitors.</p><button class="btn btn-primary" type="button" data-add="${tab}">+ Add ${tab==='events'?'event':'exhibition'}</button></div>`;
 content+=`<div class="admin-list">${items.map(item=>`<article class="admin-record"><div><h3>${escapeHtml(item.title)}</h3><p>${tab==='events'?escapeHtml(item.date):escapeHtml(item.category)} · <span class="tag">${item.published?'Published':'Draft'}</span></p></div><div class="admin-record-actions"><button class="btn btn-small btn-outline" type="button" data-edit="${item.id}">Edit</button><button class="btn btn-small btn-danger" type="button" data-delete="${item.id}">Delete</button></div></article>`).join('')}</div>`;
 if(state.admin.draft!==null)content=adminForm(tab,state.admin.draft)+content;
 }
 root.innerHTML=content;
}
function field(label,name,val='',type='text',required=true,max=110){return `<div class="form-field"><label for="manage-${name}">${label}</label><input id="manage-${name}" type="${type}" name="${name}" value="${escapeHtml(val)}" ${required?'required':''} maxlength="${max}"></div>`;}
function adminForm(tab,item){const creating=!item.id;return `<section class="contact-panel admin-form-wrap" aria-label="Content editor"><h2>${creating?'Add':'Edit'} ${tab==='events'?'event':'exhibition'}</h2><form id="admin-edit-form" data-kind="${tab}" data-id="${item.id||''}"><div class="admin-form-grid">${field('Title','title',item.title)}${tab==='exhibitions'?field('Category','category',item.category):field('Date','date',item.date,'date')}</div>${tab==='events'?field('Time (HH:MM)','time',item.time,'time'):''}<div class="form-field"><label for="manage-description">Short description</label><textarea id="manage-description" name="description" required minlength="12" maxlength="280">${escapeHtml(item.description||'')}</textarea></div>${tab==='exhibitions'?`<div class="form-field"><label for="manage-body">Full exhibition story</label><textarea id="manage-body" name="body" required minlength="30" maxlength="4000">${escapeHtml(item.body||'')}</textarea></div><div class="form-field"><label for="manage-imageKey">Illustration</label><select name="imageKey" id="manage-imageKey">${Object.keys(illustrations).map(x=>`<option value="${x}" ${item.imageKey===x?'selected':''}>${x[0].toUpperCase()+x.slice(1)}</option>`).join('')}</select></div><label class="check-line"><input name="featured" type="checkbox" ${item.featured?'checked':''}> Feature on home page</label>`:''}<label class="check-line"><input name="published" type="checkbox" ${item.published?'checked':''}> Published (visible to visitors)</label><div class="button-row"><button class="btn btn-primary" type="submit">Save changes ↗</button><button type="button" data-cancel class="btn btn-outline">Cancel</button></div><p class="form-message" id="admin-feedback" role="alert"></p></form></section>`;}
async function saveAdmin(form){const data=Object.fromEntries(new FormData(form));const tab=form.dataset.kind,id=form.dataset.id;data.published=form.elements.published.checked;if(tab==='exhibitions')data.featured=form.elements.featured.checked;const button=form.querySelector('button[type=submit]');button.disabled=true;try{await api(`/api/admin/${tab}${id?'/'+id:''}`,{method:id?'PUT':'POST',body:JSON.stringify(data)});state.admin.draft=null;await loadAdmin();await loadPublicContent();}catch(err){setFeedback('admin-feedback',err.message);}finally{button.disabled=false;}}
async function loadPublicContent(){try{const [e,v]=await Promise.all([api('/api/exhibitions'),api('/api/events')]);state.exhibitions=e.exhibitions;state.events=v.events;await Promise.all([loadSaved(),loadLikes()]);}catch{} }
async function deleteAdmin(id){const tab=state.admin.tab;if(!window.confirm(`Delete this ${tab==='events'?'event':'exhibition'}? This cannot be undone.`))return;try{await api(`/api/admin/${tab}/${id}`,{method:'DELETE'});state.admin.draft=null;await loadAdmin();await loadPublicContent();}catch(err){window.alert(err.message);}}

// Link navigation and forms are handled in one place because page content changes between routes.
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-link]');if(link&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(link.href);return;}
 const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-ns-export')||button.dataset.nsSelectUser||button.hasAttribute('data-ns-cancel-user')||button.dataset.nsRemoveCollection||button.dataset.nsRemoveItem||button.dataset.nsUserPage){features.click(button);return;}
 if(button.dataset.artifactAction||button.dataset.mysteryTap||button.dataset.selectSlot||button.dataset.cancelBooking||button.dataset.adminCheckin||button.dataset.reviewAction||button.dataset.artifactPublish||button.dataset.artifactRemove){museum.click(button);return;}
 if(button.dataset.saveKind){toggleSaved(button.dataset.saveKind,Number(button.dataset.saveId),button);return;}
 if(button.dataset.likeKind){toggleLiked(button.dataset.likeKind,Number(button.dataset.likeId),button);return;}
 if(button.id==='menu-toggle'){const nav=$('#main-nav');const open=nav.classList.toggle('open');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation':'Open navigation');}
 if(button.id==='retry-button')loadCore();
 if(button.id==='logout-button')logout();
 if(button.dataset.tab){state.admin.tab=button.dataset.tab;state.admin.draft=null;renderAdmin();}
 if(button.dataset.add){state.admin.draft={published:true,featured:false};renderAdmin();$('#admin-edit-form')?.scrollIntoView({block:'start'});}
 if(button.dataset.edit){const record=state.admin.items[state.admin.tab].find(x=>x.id===Number(button.dataset.edit));state.admin.draft={...record};renderAdmin();$('#admin-edit-form')?.scrollIntoView({block:'start'});}
 if(button.dataset.delete)deleteAdmin(Number(button.dataset.delete));
 if(button.hasAttribute('data-cancel')){state.admin.draft=null;renderAdmin();}
});
function updateExploreResults(){
  const root=$('#exhibition-results');if(!root)return;
  root.innerHTML=exhibitionResults();
  const count=$('#explore-count');if(count)count.textContent=`${filteredExhibitions().length} exhibitions`;
}
document.addEventListener('input',event=>{
 museum.onInput(event.target);features.input(event.target);
 if(event.target.id==='explore-search'){state.explore.query=event.target.value;updateExploreResults();}
});
document.addEventListener('change',event=>{museum.onChange(event.target);
 if(event.target.id==='explore-category'){state.explore.category=event.target.value;updateExploreResults();}
 if(event.target.id==='explore-sort'){state.explore.order=event.target.value;updateExploreResults();}
if(event.target.id==='show-password'){const type=event.target.checked?'text':'password';for(const id of ['auth-password','auth-confirm']){const el=document.getElementById(id);if(el)el.type=type;}}});
document.addEventListener('submit',event=>{const form=event.target;if(form.id.startsWith('ns-')||form.dataset.nsCollectionRename||form.dataset.nsAddItem){event.preventDefault();features.submit(form);return;}if(['booking-form','artifact-review-form','museum-schedule-form','artifact-add-form'].includes(form.id)){event.preventDefault();museum.submit(form);return;}if(!['auth-form','contact-form','admin-edit-form','profile-form'].includes(form.id))return;event.preventDefault();if(form.id==='auth-form')submitAuth(form);if(form.id==='contact-form')submitContact(form);if(form.id==='admin-edit-form')saveAdmin(form);if(form.id==='profile-form')saveProfile(form);});
window.addEventListener('popstate',()=>render());
$('#year').textContent=new Date().getFullYear();
loadCore();
