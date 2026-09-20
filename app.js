const SEED = window.SEED;
const LS='rkzx_v1';
let state=JSON.parse(localStorage.getItem(LS)||'null')||{answers:{},wrong:[],fav:[],done:0,correct:0,examDate:'2026-10-24',extra:[],profile:{nick:'',classCode:'SOFT2026'},records:[],lastScoreCard:''};
let pool=[], idx=0, mode='practice', locked=false, timer=null, deadline=null, casePool=[], caseIdx=0;
function makeAnswerTargetMap(){
  const items=[...(SEED.questions||[]),...(SEED.pastQuestions||[])].slice().sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
  const targets=items.map((_,i)=>i%4);
  let seed=0x5EED2026;
  function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let i=targets.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[targets[i],targets[j]]=[targets[j],targets[i]]}
  const map={}; items.forEach((q,i)=>map[String(q.id)]=targets[i]); return map;
}
const ANSWER_TARGETS=makeAnswerTargetMap();
function balanceBuiltIn(q){
  if(!q || !Array.isArray(q.options) || q.options.length!==4) return q;
  const target=ANSWER_TARGETS[String(q.id)];
  const old=Number(q.answer);
  if(target===undefined || old<0 || old>3 || old===target) return q;
  const shift=(target-old+4)%4;
  const opts=new Array(4);
  for(let i=0;i<4;i++) opts[(i+shift)%4]=q.options[i];
  return {...q,options:opts,answer:target};
}
const allQ=()=>SEED.questions.map(balanceBuiltIn).concat(state.extra||[]);
const pastQ=()=>(SEED.pastQuestions||[]).map(balanceBuiltIn);
function calcPastStats(){
  const list=pastQ(); const byKey={}, byChapter={}, byBatch={};
  list.forEach(x=>{byKey[x.key]=(byKey[x.key]||0)+1;byChapter[x.chapter]=(byChapter[x.chapter]||0)+1;byBatch[x.batch]=(byBatch[x.batch]||0)+1});
  const topKeys=Object.entries(byKey).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const topCh=Object.entries(byChapter).sort((a,b)=>b[1]-a[1]).slice(0,8);
  return {topKeys,topCh,byBatch,total:list.length};
}
function renderPastStats(){
 if(!window.pastStatsBox)return; const st=calcPastStats();
 pastStatsBox.innerHTML=`<div class="row"><div class="metric">近期题数<b>${st.total}</b></div><div class="metric">覆盖批次<b>${Object.keys(st.byBatch).length}</b></div><div class="metric">高频考点<b>${st.topKeys.length}</b></div></div><p><b>高频考点：</b><br>${st.topKeys.map(([k,n])=>`<span class="tag">${k} × ${n}</span>`).join('')}</p><p><b>章节集中度：</b><br>${st.topCh.map(([c,n])=>`<span class="tag">第${c}章 × ${n}</span>`).join('')}</p>`;}

const allWithPast=()=>allQ().concat(pastQ());
function save(){localStorage.setItem(LS,JSON.stringify(state)); updateStats();}
function go(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(p).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.p===p));window.scrollTo(0,0);if(p==='wrong')renderWrongStats();}
function updateStats(){mDone.textContent=state.done||0;mAcc.textContent=(state.done?Math.round(100*state.correct/state.done):0)+'%';mWrong.textContent=(state.wrong||[]).length;}
function init(){state.profile=state.profile||{nick:'',classCode:'SOFT2026'};state.records=state.records||[];state.caseAnswers=state.caseAnswers||{};state.lastScoreCard=state.lastScoreCard||'';examDate.value=state.examDate;const d=new Date(state.examDate+'T00:00:00');const now=new Date();const days=Math.max(0,Math.ceil((d-now)/86400000));daysLeft.textContent=days;dateText.textContent='目标考试日：'+state.examDate+'（可在设置修改）';dayProgress.style.width=Math.min(100,Math.max(0,(45-days)/45*100))+'%';chapterGrid.innerHTML=SEED.chapters.map((c,i)=>`<div class="chapter" style="padding:12px"><b>第${i+1}章 ${c}</b><small>${allQ().filter(q=>q.chapter===i+1).length} 道核心题</small><div class="row" style="margin-top:10px"><button class="btn secondary" style="padding:8px 10px" onclick="startChapterPractice(${i+1})">练习模式</button><button class="btn" style="padding:8px 10px" onclick="startChapterExam(${i+1})">章节测试</button></div></div>`).join('');homeNick.textContent=state.profile.nick||'未设置';homeClass.textContent=state.profile.classCode||'SOFT2026';nickInput.value=state.profile.nick||'';classInput.value=state.profile.classCode||'SOFT2026';scoreCardPreview.textContent=state.lastScoreCard||'完成一次模拟考试或好友挑战后，这里会生成可分享的成绩卡文字。';renderLocalBoard();renderPastBatches();renderPastStats();updateStats();renderWrongStats();}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function startDaily(){const src=allWithPast();startQuiz(shuffle(src).slice(0,Math.min(20,src.length)),'今日必刷',false)}
function startChapterPractice(ch){startQuiz(allQ().filter(q=>q.chapter===ch),`第${ch}章 ${SEED.chapters[ch-1]} · 练习`,false)}
function startChapterExam(ch){const a=shuffle(allQ().filter(q=>q.chapter===ch));startQuiz(a,`第${ch}章 ${SEED.chapters[ch-1]} · 测试`,true,Math.max(20,Math.round(a.length*1.6)))}
function startWrong(){let a=allQ().filter(q=>state.wrong.includes(q.id));if(!a.length)return alert('当前还没有错题。');startQuiz(a,'错题回炉',false)}
function startFav(){let a=allQ().filter(q=>state.fav.includes(q.id));if(!a.length)return alert('当前还没有收藏题。');startQuiz(a,'收藏题',false)}
function startMock(){let n=+mockCount.value;let mins=+mockMinutes.value;let a=shuffle(allWithPast()).slice(0,Math.min(n,allWithPast().length));startQuiz(a,'综合知识模拟',true,mins)}
function startQuiz(a,title,isMock=false,mins=0){if(!a.length)return alert('没有可用题目');pool=a;idx=0;mode=isMock?'mock':'practice';locked=false;state.session={};save();go('quiz');quizMeta.textContent=title;quizMeta.dataset.title=title;paletteCard.style.display=isMock?'block':'none';if(isMock){submitBtn.style.display='inline-block';startTimer(mins*60,'quizTimer',()=>submitMock())}else{submitBtn.style.display='none';clearInterval(timer);quizTimer.textContent=''}renderQ()}
function renderQ(){const q=pool[idx];if(!q)return;qText.textContent=`${idx+1}. ${q.question}`;const given=state.session?.[q.id];locked=(mode==='practice'&&given!==undefined);qOptions.innerHTML=q.options.map((o,i)=>`<button class="opt ${given===i?'selected':''}" onclick="choose(${i})">${String.fromCharCode(65+i)}. ${o}</button>`).join('');qAnswer.innerHTML='';if(locked)showExplain(given);quizMeta.textContent=(quizMeta.dataset.title||'练习')+` · ${idx+1}/${pool.length}`;favBtn.textContent=state.fav.includes(q.id)?'★ 已收藏':'☆ 收藏';if(mode==='mock')renderPalette()}
function choose(i){const q=pool[idx];if(mode==='practice'&&state.session[q.id]!==undefined)return;if(mode==='practice'&&state.session[q.id]===undefined){state.done++;if(i===q.answer)state.correct++;else if(!state.wrong.includes(q.id))state.wrong.push(q.id)}state.session[q.id]=i;save();if(mode==='practice'){locked=true;showExplain(i)}else renderQ()}
function showExplain(given){const q=pool[idx];const opts=[...qOptions.children];opts.forEach((b,i)=>{if(i===q.answer)b.classList.add('correct');if(i===given&&i!==q.answer)b.classList.add('wrong')});qAnswer.innerHTML=`<div class="answer"><div class="${given===q.answer?'goodtxt':'badtxt'}">${given===q.answer?'回答正确':'回答错误'} · 正确答案 ${String.fromCharCode(65+q.answer)}</div><div><b>考点：</b>${q.key}</div><div><b>解析：</b>${q.explain}</div></div>`}
function nextQ(){if(idx<pool.length-1){idx++;mode==='review'?renderReview():renderQ();window.scrollTo(0,0)}else if(mode==='mock')submitMock();else alert(mode==='review'?'复盘完成':'本组题已完成')}
function prevQ(){if(idx>0){idx--;mode==='review'?renderReview():renderQ();window.scrollTo(0,0)}}
function toggleFav(){const id=pool[idx].id;const p=state.fav.indexOf(id);if(p>=0)state.fav.splice(p,1);else state.fav.push(id);save();renderQ()}
function manualSubmit(){if(mode!=='mock')return;const answered=pool.filter(q=>state.session[q.id]!==undefined).length;const left=pool.length-answered;const msg=left>0?`还有 ${left} 道题未作答，确认交卷吗？`:'确认交卷并查看成绩与解析吗？';if(confirm(msg))submitMock()}
function renderPalette(){palette.innerHTML=pool.map((q,i)=>`<button class="${state.session[q.id]!==undefined?'done':''} ${i===idx?'cur':''}" onclick="idx=${i};renderQ()">${i+1}</button>`).join('')}
function submitMock(){clearInterval(timer);const answered=pool.filter(q=>state.session[q.id]!==undefined);const score=pool.filter(q=>state.session[q.id]===q.answer).length;const unanswered=pool.length-answered.length;state.done+=answered.length;state.correct+=score;const kind=state.currentChallenge?'好友挑战':'综合知识模拟';addRecord(kind,score,pool.length);state.currentChallenge='';alert(`${kind}结束\n得分：${score} / ${pool.length}\n未答：${unanswered}\n正确率：${Math.round(score/pool.length*100)}%`);mode='review';paletteCard.style.display='none';submitBtn.style.display='none';pool.forEach(q=>{if(state.session[q.id]!==q.answer&&!state.wrong.includes(q.id))state.wrong.push(q.id)});save();idx=0;renderReview()}
function renderReview(){mode='review';const q=pool[idx];qText.textContent=`${idx+1}. ${q.question}`;const given=state.session[q.id];qOptions.innerHTML=q.options.map((o,i)=>`<button class="opt ${i===q.answer?'correct':''} ${i===given&&i!==q.answer?'wrong':''}">${String.fromCharCode(65+i)}. ${o}</button>`).join('');qAnswer.innerHTML=`<div class="answer"><b>你的答案：</b>${given===undefined?'未作答':String.fromCharCode(65+given)}　<b>正确答案：</b>${String.fromCharCode(65+q.answer)}<br><b>解析：</b>${q.explain}</div>`;quizMeta.textContent=`模拟复盘 · ${idx+1}/${pool.length}`;quizTimer.textContent=''}
function startTimer(sec,el,done){clearInterval(timer);deadline=Date.now()+sec*1000;const e=document.getElementById(el);function tick(){let s=Math.max(0,Math.ceil((deadline-Date.now())/1000));let h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;e.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;if(s<=0){clearInterval(timer);done()}}tick();timer=setInterval(tick,1000)}
function renderWrongStats(){const arr=allQ().filter(q=>state.wrong.includes(q.id));const by={};arr.forEach(q=>by[q.chapter]=(by[q.chapter]||0)+1);wrongStats.innerHTML=arr.length?`<b>共 ${arr.length} 道错题</b><p>${Object.entries(by).map(([c,n])=>`<span class="tag">第${c}章 ${n}题</span>`).join('')}</p>`:'目前没有错题。'}
function clearWrong(){if(confirm('确认清空错题本？')){state.wrong=[];save();renderWrongStats()}}

function renderPastBatches(){
  if(!window.pastBatchGrid)return;
  const base=SEED.pastBatches||[];
  const batches=base.map(b=>({...b,count:pastQ().filter(q=>q.batch===b.id).length}));
  pastBatchGrid.innerHTML=batches.map(b=>`<div class="chapter"><b>${b.label}</b><small>${b.note} · ${b.count}题</small><div class="row" style="margin-top:10px"><button class="btn secondary" style="padding:8px 10px" onclick="startPastBatch('${b.id}',false)">练习</button><button class="btn" style="padding:8px 10px" onclick="startPastBatch('${b.id}',true)">测试</button></div></div>`).join('');
}
function startPastBatch(batch,isExam){
  const a=pastQ().filter(q=>q.batch===batch);
  if(!a.length)return alert('该批次题目还在整理中');
  startQuiz(shuffle(a),batch+(isExam?' · 测试':' · 练习'),isExam,isExam?Math.max(25,Math.round(a.length*1.6)):0);
}
function startPastMix(isExam){
  const a=shuffle(pastQ());
  if(!a.length)return alert('近期真题题库还在整理中');
  const count=Math.min(isExam?45:30,a.length);
  startQuiz(a.slice(0,count),isExam?'近三期真题考点模拟':'近三期真题考点练习',isExam,isExam?70:0);
}
function startPastCases(){
  casePool=shuffle(SEED.pastCases||[]);
  if(!casePool.length)return alert('近期案例专项还在整理中');
  caseIdx=0;go('caseExam');startTimer(100*60,'caseTimer',()=>alert('案例训练时间到'));renderCase();
}

function startCaseExam(){casePool=shuffle(SEED.cases).slice(0,4);caseIdx=0;go('caseExam');startTimer(120*60,'caseTimer',()=>alert('案例训练时间到'));renderCase()}
function saveCaseDraft(){
  const c=casePool[caseIdx]; if(!c||!window.caseInput)return;
  state.caseAnswers=state.caseAnswers||{};
  state.caseAnswers[c.title]=caseInput.value||'';
  localStorage.setItem(LS,JSON.stringify(state));
}
function renderCase(){
  const c=casePool[caseIdx]; if(!c)return;
  const g=window.getCaseGuide?window.getCaseGuide(c):{category:'案例分析',template:[]};
  caseMeta.textContent=`案例模拟 · ${caseIdx+1}/${casePool.length}`;
  caseTitle.textContent=c.title;
  if(window.caseCategory)caseCategory.textContent=g.category||'案例分析';
  caseScenario.textContent=c.scenario;
  state.caseAnswers=state.caseAnswers||{};
  caseInput.value=state.caseAnswers[c.title]||'';
  casePoints.innerHTML='';caseScore.innerHTML='';caseReference.innerHTML='';caseTemplate.innerHTML='';
}
function updateCaseSelfScore(){
  const c=casePool[caseIdx]; if(!c)return;
  const checks=[...casePoints.querySelectorAll('input[type=checkbox]')];
  const hit=checks.filter(x=>x.checked).length,total=checks.length;
  caseScore.innerHTML=`<div class="answer"><b>踩点自评：${hit}/${total}</b>（约 ${total?Math.round(hit/total*100):0}%）<br><span class="notice">这是按得分点数量做的练习自评，不等同于官方阅卷分数。建议先独立作答，再勾选真正写到的点。</span></div>`;
}
function showCasePoints(){
  saveCaseDraft();
  const c=casePool[caseIdx];
  casePoints.innerHTML=`<div class="answer"><b>建议得分点</b>${c.points.map((p,i)=>`<label class="casepoint"><input type="checkbox" onchange="updateCaseSelfScore()">${i+1}. ${p}</label>`).join('')}<p><b>命题解析：</b>${c.analysis}</p></div>`;
  updateCaseSelfScore();
}
function showCaseReference(){
  saveCaseDraft();
  const c=casePool[caseIdx]; const g=window.getCaseGuide?window.getCaseGuide(c):{};
  const refs=(g.reference&&g.reference.length)?g.reference:c.points.map(p=>p.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/,'')); 
  caseReference.innerHTML=`<div class="answer"><b>参考作答</b><ol style="padding-left:22px;line-height:1.75">${refs.map(x=>`<li>${x}</li>`).join('')}</ol><div class="notice">参考答案按教材知识点与案例得分逻辑整理。考场不要求逐字一致，关键是覆盖要点、表达具体、避免只写“加强管理/加强沟通”等空泛语句。</div></div>`;
}
function showCaseTemplate(){
  const c=casePool[caseIdx]; const g=window.getCaseGuide?window.getCaseGuide(c):{category:'案例分析',template:[]};
  caseTemplate.innerHTML=`<div class="answer"><b>${g.category||'案例分析'}通用答题模板</b><ol style="padding-left:22px;line-height:1.75">${(g.template||[]).map(x=>`<li>${x}</li>`).join('')}</ol><div class="notice">模板用于帮助组织答案，实际作答必须结合题干事实，不要机械照抄。</div></div>`;
}
function nextCase(){saveCaseDraft();if(caseIdx<casePool.length-1){caseIdx++;renderCase();window.scrollTo(0,0)}else alert(`${casePool.length}道案例已完成。建议逐题使用“踩点自评”和“参考答案”复盘遗漏点。`)}
function prevCase(){saveCaseDraft();if(caseIdx>0){caseIdx--;renderCase();window.scrollTo(0,0)}}
function saveExamDate(){state.examDate=examDate.value||state.examDate;save();init();alert('已保存')}
function importQuestions(){try{const arr=JSON.parse(importBox.value);if(!Array.isArray(arr))throw Error();const base=10000+(state.extra?.length||0);const clean=arr.map((x,i)=>({id:base+i,chapter:+x.chapter||1,question:String(x.question),options:x.options,answer:+x.answer,explain:String(x.explain||''),key:String(x.key||'自定义题'),difficulty:x.difficulty||'中',source:x.source||'自有导入'})).filter(x=>Array.isArray(x.options)&&x.options.length===4&&x.answer>=0&&x.answer<4);state.extra=(state.extra||[]).concat(clean);save();init();alert(`成功导入 ${clean.length} 道题`)}catch(e){alert('JSON格式不正确，请按示例检查。')}}
function exportProgress(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='软考中项学习数据.json';a.click();URL.revokeObjectURL(a.href)}
function saveProfile(){const nick=(nickInput.value||'').trim();const cls=(classInput.value||'SOFT2026').trim().toUpperCase();if(!nick)return alert('请先填写昵称');state.profile={nick,classCode:cls||'SOFT2026'};save();init();alert('共享资料已保存')}
function simpleHash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36).toUpperCase()}
function seededPick(count,seedText){let seed=0;for(let i=0;i<seedText.length;i++)seed=(seed*31+seedText.charCodeAt(i))>>>0;const arr=[...allQ()];function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr.slice(0,Math.min(count,arr.length))}
function createChallenge(){const count=+challengeCount.value;const cls=(state.profile.classCode||'SOFT2026').toUpperCase();const stamp=new Date().toISOString().slice(0,10).replaceAll('-','');const seed=simpleHash(cls+'-'+stamp+'-'+count);const code=`${cls}-${count}-${seed}`;challengeBox.innerHTML=`<div class="answer"><b>挑战码</b><div style="font-size:18px;font-weight:900;word-break:break-all;margin:8px 0">${code}</div><button class="btn secondary" onclick="navigator.clipboard?.writeText('${code}').then(()=>alert('已复制挑战码'))">复制挑战码</button></div>`}
function parseChallenge(code){const m=String(code||'').trim().toUpperCase().match(/^(.+)-(\d+)-([A-Z0-9]+)$/);if(!m)return null;return{cls:m[1],count:+m[2],seed:m[3],raw:String(code||'').trim().toUpperCase()}}
function joinChallenge(){const c=parseChallenge(joinCode.value);if(!c)return alert('挑战码格式不正确');const a=seededPick(c.count,c.raw);state.currentChallenge=c.raw;startQuiz(a,`好友挑战 · ${c.cls}`,true,Math.max(30,Math.round(c.count*1.6)))}
function addRecord(type,score,total){const rec={type,nick:(state.profile?.nick||'匿名同学'),classCode:(state.profile?.classCode||'SOFT2026'),score,total,acc:Math.round(score/total*100),time:new Date().toLocaleString()};state.records=state.records||[];state.records.push(rec);state.records=state.records.slice(-100);state.lastScoreCard=`【软考中项·共享题库】\n${rec.nick}｜${rec.classCode}\n${type}\n成绩：${score}/${total}（${rec.acc}%）\n时间：${rec.time}\n一起刷题，10月上岸！`;save();renderLocalBoard()}
function renderLocalBoard(){if(!window.localBoard)return;const arr=[...(state.records||[])].sort((a,b)=>b.acc-a.acc||b.score-a.score).slice(0,20);if(!arr.length){localBoard.innerHTML='<span class="muted">暂无成绩记录</span>';return}localBoard.innerHTML=arr.map((r,i)=>`<div style="display:grid;grid-template-columns:34px 1fr auto;gap:8px;padding:9px 0;border-bottom:1px solid var(--line)"><b>#${i+1}</b><div><b>${r.nick}</b><div class="notice">${r.type} · ${r.time}</div></div><b>${r.score}/${r.total}</b></div>`).join('')}
function copyScoreCard(){const t=state.lastScoreCard||'暂无成绩卡';if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>alert('成绩卡已复制'));else prompt('复制下面内容',t)}
function exportClassData(){const payload={profile:state.profile,records:state.records||[],exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${state.profile?.classCode||'班级'}_成绩数据.json`;a.click();URL.revokeObjectURL(a.href)}
init();
