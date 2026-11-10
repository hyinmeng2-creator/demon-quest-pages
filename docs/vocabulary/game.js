const $ = id => document.getElementById(id);
const mode = document.body.dataset.module;
const key = 'week11-quest-' + mode;
const sessionKey = key + '-skill-errors';
const blank = () => ({history:[], pending:[], active:null, preferredSkill:'', nextScaffold:null});
let state;
try { state = {...blank(), ...JSON.parse(localStorage.getItem(key) || '{}')}; } catch { state = blank(); }
let sessionErrors;
try { sessionErrors = JSON.parse(sessionStorage.getItem(sessionKey) || '{}'); } catch { sessionErrors = {}; }
let bank = [];
const arena = document.querySelector('.arena');
const normalize = value => String(value).trim().toLowerCase().replace(/’/g,"'").replace(/[.!?]$/,'');
const store = () => { localStorage.setItem(key, JSON.stringify(state)); sessionStorage.setItem(sessionKey, JSON.stringify(sessionErrors)); };
const item = id => bank.find(q => q.id === id);
const seen = id => state.history.filter(h => h.itemId === id).length;
const completed = () => state.history.length;
const correctFirst = () => state.history.filter(h => h.firstCorrect).length;
const attempts = () => completed() + (state.active?.attempts > 0 && !state.active.solved ? 1 : 0);
const defeats = () => state.history.length;

fetch(document.body.dataset.bank).then(r => { if (!r.ok) throw Error(r.status); return r.json(); }).then(data => {
  bank = data.items.filter(q => q.module === mode);
  const skills = [...new Set(bank.map(q => q.skill))];
  skills.forEach(skill => $('mission').add(new Option(skill.replaceAll('_',' / '),skill)));
  $('mission').value = state.preferredSkill || '';
  if (!item(state.active?.itemId)) chooseNext();
  render();
}).catch(() => { $('question').textContent = 'Question bank unavailable. Start the local website and reload.'; });

function chooseNext() {
  const now = completed();
  let q = null, reason = '';
  if (state.nextScaffold) {
    const {skill, explanation} = state.nextScaffold;
    q = bank.filter(x => x.skill === skill && seen(x.id) === 0 && !state.pending.some(p => p.itemId === x.id))
      .sort((a,b) => a.level-b.level)[0];
    reason = q ? 'Skill support: '+explanation+' Try this related task.' : 'Skill support: '+explanation+' The bank has no unseen easier or contrasting task for this skill.';
    state.nextScaffold = null;
  }
  if (!q) {
    const due = state.pending.find(p => p.eligibleAfter <= now);
    if (due) { q = item(due.itemId); state.pending = state.pending.filter(p => p !== due); reason = 'Review: this question returns after three other completed tasks.'; }
  }
  if (!q && state.preferredSkill) q = bank.find(x => x.skill === state.preferredSkill && seen(x.id) === 0 && !state.pending.some(p => p.itemId === x.id));
  if (!q) q = bank.find(x => seen(x.id) === 0 && !state.pending.some(p => p.itemId === x.id));
  if (!q) q = bank.filter(x => !state.pending.some(p => p.itemId === x.id)).sort((a,b) => seen(a.id)-seen(b.id))[0];
  if (!q) q = bank[0];
  state.active = {itemId:q.id, firstAnswer:null, firstCorrect:null, attempts:0, hints:0, retries:0, solved:false, reason};
  store();
}
function render() {
  const q = item(state.active.itemId), a = state.active;
  arena.classList.toggle('won',a.solved);arena.classList.toggle('blocked',a.attempts>0 && !a.solved);
  $('battle-title').textContent = 'Level '+(Math.floor(defeats()/5)+1)+' · Forest gate';
  $('battle-status').textContent = a.solved ? 'Spell cast! One demon defeated.'+(defeats()%5===0?' Level complete!':'') : a.attempts ? 'The demon is still standing. Use the hint and try again.' : 'One correct answer casts a spell.';
  $('item-id').textContent=q.id; $('skill').textContent=q.skill.replaceAll('_',' / ');
  $('question').textContent=q.prompt;$('scaffold').hidden=!a.reason;$('scaffold').textContent=a.reason;
  $('choices').replaceChildren();$('entry-wrap').hidden=q.type!=='text';$('entry').value='';
  if(q.type==='choice')q.choices.forEach((choice,index)=>{
    const button=document.createElement('button');button.type='button';button.className='choice-button';button.textContent=choice;
    button.disabled=a.solved;button.onclick=()=>check(index);$('choices').append(button);
  });
  $('check').hidden=q.type!=='text';$('check').disabled=a.solved;$('hint').disabled=a.solved;$('next').disabled=!a.solved;
  $('feedback').textContent=a.solved?'Correct. '+q.explanation : a.attempts?'Not yet. '+q.hint : '';
  updateProgress();
}
function check(answer) {
  const q=item(state.active.itemId), a=state.active;
  if(a.solved)return;
  if(q.type==='text' && !normalize(answer)) { $('feedback').textContent='Enter an answer first.'; return; }
  const isCorrect=q.type==='choice' ? answer===q.answer : q.accepted.some(x=>normalize(x)===normalize(answer));
  if(a.attempts===0) { a.firstAnswer=q.type==='choice'?q.choices[answer]:String(answer).trim(); a.firstCorrect=isCorrect; }
  else a.retries++;
  a.attempts++;
  if(isCorrect) {
    a.solved=true;
    state.history.push({itemId:q.id,skill:q.skill,firstAnswer:a.firstAnswer,firstCorrect:a.firstCorrect,hints:a.hints,retries:a.retries});
    if(!a.firstCorrect) {
      state.pending.push({itemId:q.id,eligibleAfter:completed()+3});
      sessionErrors[q.skill]=(sessionErrors[q.skill]||0)+1;
      if(sessionErrors[q.skill]===2) { state.nextScaffold={skill:q.skill,explanation:q.explanation}; $('scaffold').textContent='Two first-attempt errors on '+q.skill.replaceAll('_',' / ')+'. '+q.explanation+' A related task is next.'; $('scaffold').hidden=false; }
    }
    arena.classList.remove('blocked');arena.classList.remove('won');void arena.offsetWidth;arena.classList.add('won');
    $('battle-status').textContent='Spell cast! One demon defeated.'+(defeats()%5===0?' Level complete!':'');
    $('feedback').textContent='Correct. '+q.explanation+(a.firstCorrect?'':' Your first attempt stays recorded as incorrect.');
    $('hint').disabled=true;$('check').disabled=true;document.querySelectorAll('.choice-button').forEach(b=>b.disabled=true);$('next').disabled=false;
  } else {
    if(a.hints===0)a.hints=1;
    arena.classList.add('blocked');$('battle-status').textContent='The demon is still standing. Use the hint and try again.';
    $('feedback').textContent='Not yet. '+q.hint;
  }
  store();updateProgress();
}
function updateProgress() {
  const first=correctFirst()+(state.active?.firstCorrect===true && !state.active.solved?1:0);
  const total=attempts();
  const hints=state.history.reduce((n,h)=>n+h.hints,0)+(state.active?.solved?0:state.active?.hints||0);
  const retries=state.history.reduce((n,h)=>n+h.retries,0)+(state.active?.solved?0:state.active?.retries||0);
  $('defeats').textContent=defeats();$('first-accuracy').textContent=total?first+'/'+total:'0/0';
  $('hints-count').textContent=hints;$('retries-count').textContent=retries;
  $('level-progress').textContent=(defeats()%5)+'/5 to next level';
  $('level-meter').value=defeats()%5;
}
$('check').onclick=()=>check($('entry').value);
$('entry').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();check($('entry').value)}};
$('hint').onclick=()=>{if(state.active.solved)return;state.active.hints=1;$('feedback').textContent=item(state.active.itemId).hint;store();updateProgress()};
$('next').onclick=()=>{if(!state.active.solved)return;chooseNext();render();$('question').focus()};
$('mission').onchange=()=>{state.preferredSkill=$('mission').value;if(state.active?.attempts===0){chooseNext();render()}else{$('feedback').textContent='Finish this battle, then the selected skill will be used.'}store()};
$('reset').onclick=()=>{state=blank();sessionErrors={};localStorage.removeItem(key);sessionStorage.removeItem(sessionKey);$('mission').value='';chooseNext();render()};
