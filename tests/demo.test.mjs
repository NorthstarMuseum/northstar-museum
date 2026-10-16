import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {verifyPassword} from '../server/auth.mjs';
const script=fileURLToPath(new URL('../scripts/prepare-demo.mjs',import.meta.url));
test('Demo preparation creates separate sample DB, random credentials, and never overwrites it',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'northstar-class-demo-'));
 try{
  const first=execFileSync(process.execPath,[script],{cwd,encoding:'utf8'});
  const file=join(cwd,'data','northstar-class-demo.sqlite');
  assert.ok(existsSync(file));
  assert.equal(existsSync(join(cwd,'data','northstar.sqlite')),false);
  const creds=first.match(/Visitor: visitor@northstar\.demo \| Password: (\S+)/);
  assert.ok(creds);assert.match(first,/Admin:/);
  const db=new DatabaseSync(file);
  try{
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,2);
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mini_exhibitions').get().n,1);
   const visitor=db.prepare('SELECT password_hash FROM users WHERE email=?').get('visitor@northstar.demo');
   assert.equal(verifyPassword(creds[1],visitor.password_hash),true);
  }finally{db.close();}
  assert.throws(()=>execFileSync(process.execPath,[script],{cwd,stdio:'pipe'}));
  assert.ok(existsSync(file));
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
