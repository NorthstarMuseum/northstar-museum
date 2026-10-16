import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Render helpers run without their browser bootstrap so the page HTML can be checked separately.
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').split('// Link navigation and forms are handled')[0].replace(/^import [^\n]+\n/gm, '');
const context=vm.createContext({createStudentUI:()=>({section:()=>'',loadedPage:()=>{},click:()=>{},submit:()=>{}}),createFeaturesUI:()=>({section:()=>'',loadedPage:()=>{},click:()=>{},submit:()=>{},input:()=>{}}),createMuseumUI:()=>({account:()=>'',adminSection:()=>'',page:()=>null}),Date,URL,location:{pathname:'/exhibitions'},window:{},console,fetch(){throw new Error('Network not used in UI markup tests');}});
vm.runInContext(code,context);
const evaluate=src=>vm.runInContext(src,context);
const exhibition={id:1,slug:'echoes-in-stone',title:'Echoes in Stone',category:'ART & SCULPTURE',description:'A fictional exhibit',body:'A longer fictional story',imageKey:'stone',featured:true,likeCount:3};
const event={id:2,title:'Creative Studio',description:'A local fictional event',date:'2030-01-01',time:'14:00',likeCount:2};

test('Cards display visible likes separately from saved items',()=>{
  evaluate(`state.exhibitions=[${JSON.stringify(exhibition)}];state.events=[${JSON.stringify(event)}]`);
  const card=evaluate('exhibitionCard(state.exhibitions[0])');
  assert.match(card,/data-like-kind="exhibitions"/);
  assert.match(card,/class="like-count">3/);
  assert.match(card,/data-save-kind="exhibitions"/);
  assert.match(evaluate('eventRow(state.events[0])'),/data-like-kind="events"/);
});

test('Liked state and profile sections reflect only member data',()=>{
  evaluate(`state.user={id:4,name:'Visitor',email:'test@example.com',role:'visitor'};state.likes={exhibitions:[${JSON.stringify(exhibition)}],events:[${JSON.stringify(event)}]};state.saved={exhibitions:[],events:[]}`);
  const button=evaluate('likeButton("exhibitions",1,"Echoes in Stone",3)');
  assert.match(button,/aria-pressed="true"/);
  assert.match(button,/Liked/);
  const page=evaluate('account()');
  assert.match(page,/Exhibitions you/);
  assert.match(page,/Events you/);
  assert.match(page,/Saved/);
  assert.match(page,/things liked/);
  assert.match(page,/class="like-count">3/);
});

test('Search, categories and most liked sorting are functional',()=>{
  evaluate(`state.exhibitions=[${JSON.stringify(exhibition)},{id:3,slug:'pages-of-time',title:'Pages of Time',category:'LANGUAGE & CULTURE',description:'Fictional writing',body:'Reading books',imageKey:'paper',featured:false,likeCount:9}];state.explore={query:'',category:'all',order:'popular'}`);
  assert.equal(evaluate('filteredExhibitions()[0].title'),'Pages of Time');
  evaluate(`state.explore.query='stone'`);
  assert.equal(evaluate('filteredExhibitions().length'),1);
  assert.equal(evaluate('filteredExhibitions()[0].title'),'Echoes in Stone');
  evaluate(`state.explore.query='';state.explore.category='LANGUAGE & CULTURE'`);
  assert.equal(evaluate('filteredExhibitions()[0].title'),'Pages of Time');
});

test('Exhibition rendering escapes risky content in labels and headings',()=>{
  evaluate(`state.exhibitions=[{...${JSON.stringify(exhibition)},title:'<img src=x onerror=alert(1)>'}];state.explore={query:'',category:'all',order:'featured'}`);
  const page=evaluate('exhibitions()');
  assert.doesNotMatch(page,/<img src=x onerror=/);
  assert.match(page,/&lt;img src=x onerror=alert\(1\)&gt;/);
});
