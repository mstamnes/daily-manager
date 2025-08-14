/* Daily Manager (Non‑PWA) — integrated agenda + week + settings; 30‑min default; quick edit */
(function(){
  const dayKey = (d = new Date()) => { const tz = d.getTimezoneOffset()*60000; return new Date(d - tz).toISOString().slice(0,10); };
  const weekKey = (d) => { const dd = new Date(d); const sun = new Date(dd); sun.setDate(dd.getDate() - dd.getDay()); return dayKey(sun); };
  const pad = (n)=>String(n).padStart(2,'0');
  const toHM = (t)=>{ const [h,m]=String(t).split(':').map(Number); return {h: h||0, m: m||0}; };
  const toMin = (t)=>{ const {h,m}=toHM(t); return h*60+m; };
  const fromMin = (mins)=> pad(Math.floor(mins/60))+":"+pad(mins%60);
  const h = (tag, attrs={}, ...children) => { const el = document.createElement(tag);
    for (const k in attrs){ if (k==='class') el.className = attrs[k];
      else if (k==='style') Object.assign(el.style, attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k]==='function') el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k]!==false && attrs[k]!==null && attrs[k]!==undefined) el.setAttribute(k, attrs[k]);
    }
    children.flat().forEach(c=>{ if (c==null) return; el.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c); });
    return el;
  };
  const clear = (el)=>{ while (el.firstChild) el.removeChild(el.firstChild); };

  // storage (local only; per device)
  const LS_KEY = "dm-data-v1";
  const LS_PHASES = "dm-phases-v1";
  const LS_TAB = "dm-tab";
  const getState = ()=>{ try { return JSON.parse(localStorage.getItem(LS_KEY))||{}; } catch { return {}; } };
  const setState = (s)=> localStorage.setItem(LS_KEY, JSON.stringify(s));
  const getDay = (dateISO)=>{ const s=getState(); return s[dateISO] || { checks:{}, slotSize:30, overrides:{} }; };
  const setDay = (dateISO, updater)=>{ const s=getState(); const prev = s[dateISO] || { checks:{}, slotSize:30, overrides:{} }; const next = typeof updater==='function' ? updater(prev) : updater; s[dateISO]=next; setState(s); };

  const getPhases = ()=>{ try { return JSON.parse(localStorage.getItem(LS_PHASES))||{}; } catch { return {}; } };
  const setPhases = (map)=> localStorage.setItem(LS_PHASES, JSON.stringify(map));

  // defaults — integrated timeline items
  const SUPPS = [
    {"id":"sunfiber-am","name":"Sunfiber","timing":"Mid-morning","time":"10:00","relative":"with-water","notes":"Window: 9:30–10:30 AM."},
    {"id":"inositol","name":"Inositol","timing":"AM or PM with water","time":"10:05","relative":"with-water","notes":"Supports glucose regulation."},
    {"id":"berberine","name":"Berberine","timing":"With first meal","time":"12:00","relative":"with-meal","notes":"Pair with higher-carb meals."},
    {"id":"omega3","name":"Omega-3","timing":"With meals (fat)","time":"12:05","relative":"with-meal","notes":"Keep overall sat fat low."},
    {"id":"sunfiber-pm","name":"Sunfiber","timing":"Mid-afternoon","time":"15:00","relative":"with-water","notes":"Window: 2:30–3:30 PM."},
    {"id":"glycine","name":"Glycine","timing":"Evening wind-down","time":"20:30","relative":"with-water","notes":"Sleep support."}
  ];
  const MEALS = [
    {"id":"coffee","label":"Coffee/Tea (decaf or half-caf)","time":"07:15","notes":"Hydrate first; light sip is okay."},
    {"id":"breakfast","label":"Breakfast (fiber+protein, low sat fat)","time":"08:30","notes":"Fiber + protein first."},
    {"id":"lunch","label":"Lunch","time":"12:00","notes":"Lean protein + veg + fiber."},
    {"id":"walk1","label":"10-15 min walk","time":"12:30","notes":"Post-meal glucose assist."},
    {"id":"snack","label":"Snack (protein+fiber)","time":"15:30","notes":"Optional; align with Sunfiber."},
    {"id":"dinner","label":"Dinner","time":"18:00","notes":"Veggie-forward + lean protein."},
    {"id":"walk2","label":"10-15 min walk","time":"18:40","notes":"Gentle pace—ACL friendly."}
  ];
  const EXS = [
    {"id":"heel-slides","label":"Heel slides","sets":3,"reps":10,"time":"09:30"},
    {"id":"quad-sets","label":"Quad sets","sets":3,"reps":15,"time":"10:30"},
    {"id":"tke","label":"Terminal knee extensions (band)","sets":3,"reps":12,"time":"13:30"},
    {"id":"spanish-squat","label":"Spanish squats","sets":3,"reps":10,"time":"16:00"},
    {"id":"hip-bridge","label":"Glute bridge","sets":3,"reps":12,"time":"17:00"},
    {"id":"core","label":"Core: dead bug / side plank (knees)","sets":3,"reps":30,"time":"17:30","unit":"sec"}
  ];
  const SKD = [
    {"id":"cleanse-am","label":"Cleanse (AM)","time":"07:45"},
    {"id":"vitc","label":"Vitamin C serum (AM)","time":"07:50"},
    {"id":"spf","label":"Mineral SPF (AM)","time":"08:00"},
    {"id":"cleanse-pm","label":"Cleanse (PM)","time":"21:00"},
    {"id":"treat","label":"Treatment (retinoid/alt) (PM)","time":"21:10"},
    {"id":"moist","label":"Moisturize (PM)","time":"21:15"}
  ];
  const SKW = [
    {"id":"exfol","label":"Gentle exfoliation","day":2,"time":"19:30"},
    {"id":"mask","label":"Hydrating mask","day":5,"time":"19:40"}
  ];
  const MANTRAS = [
    "Strong, curious, and getting better every day.",
    "Tiny checkmarks, huge momentum.",
    "Fuel, move, glow—one window at a time.",
    "Progress over perfection; tiny wins compound.",
    "Stronger knees, kinder self-talk."
  ];
  const ACL_PHASES = {
    "none":[],
    "phase1":[{"id":"p1-slr","label":"SLR variations","sets":3,"reps":12,"time":"15:30"}],
    "phase2":[{"id":"p2-stepup","label":"Step-ups (low box)","sets":3,"reps":10,"time":"16:00"}],
    "phase3":[{"id":"p3-splitsq","label":"Split squats (supported)","sets":3,"reps":8,"time":"16:30"}]
  };

  function buildEvents({dateISO, supps, meals, exs, skd, skw, overrides={}, phase='none'}){
    const phaseAdds = ACL_PHASES[phase] || [];
    const allEx = [...exs, ...phaseAdds];
    const out=[];
    const add=(kind,id,time,title,desc)=>{ const key=kind+'-'+id; const t=overrides[key]||time; out.push({kind,id,time:t,title,desc,key,sort:toMin(t)}); };
    supps.forEach(s=>add('supp',s.id,s.time,s.name, `${s.timing}${s.relative?(' • '+s.relative):''}${s.notes?(' • '+s.notes):''}`));
    meals.forEach(m=>add('meal',m.id,m.time,m.label, m.notes||''));
    allEx.forEach(x=>add('ex',x.id,x.time,x.label, `${x.sets} x ${x.reps}${x.unit?(' '+x.unit):' reps'}`));
    skd.forEach(s=>add('sk',s.id,s.time||'08:00',s.label,'Daily'));
    const wd=new Date(dateISO).getDay();
    skw.filter(w=>w.day===wd).forEach(w=>add('skw',w.id,w.time||'19:30',w.label,'Weekly'));
    out.sort((a,b)=>a.sort-b.sort);
    return out;
  }
  function groupWindows(evs, slot){ const slots=[]; const start=6*60, end=22*60; for(let t=start;t<=end;t+=slot){ const tEnd=Math.min(t+slot-1,end); const items=evs.filter(e=>e.sort>=t && e.sort<=tEnd); if(items.length) slots.push({start:t,end:tEnd,items}); } return slots; }

  function icsDate(date, time){ const [h,m]=time.split(':').map(Number); const d=new Date(date); d.setHours(h,m,0,0); return new Date(d - d.getTimezoneOffset()*60000).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z'; }
  function exportICSFor(dateISO, evs){
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Daily Manager//EN',
      ...evs.map(e=>['BEGIN:VEVENT',`UID:${e.key}-${e.time}-${dateISO}`,`DTSTAMP:${icsDate(dateISO,'00:00')}`,`DTSTART:${icsDate(dateISO,e.time)}`,'DURATION:PT15M',`SUMMARY:${e.title}`, e.desc?`DESCRIPTION:${e.desc.replace(/\n/g,'\\n')}`:'', 'END:VEVENT'].filter(Boolean).join('\n')),
      'END:VCALENDAR'].join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'})); a.download='DailyManager-'+dateISO+'.ics'; a.click();
  }

  const BEEP = (function(){ try { return new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAAABAQEBAQEA'); } catch(e){ return null; } })();
  async function enableNoti(){ try{ const p=await Notification.requestPermission(); alert(p==='granted'?'Notifications enabled':'Notifications not allowed'); }catch(e){ alert('Notifications not supported'); } }
  function scheduleToday(dateISO, events){
    window.__dmTOs?.forEach(clearTimeout); window.__dmTOs=[];
    const now=new Date();
    events.forEach(ev=>{ const [h,m]=ev.time.split(':').map(Number); const t=new Date(dateISO); t.setHours(h,m,0,0); const delay=t-now; if(delay>500){ const id=setTimeout(()=>{ try{ if(Notification.permission==='granted') new Notification('Reminder',{body:ev.time+' — '+ev.title}); }catch(e){} try{ navigator.vibrate&&navigator.vibrate(150);}catch(e){} try{ BEEP&&BEEP.play&&BEEP.play(); }catch(e){} }, delay); (window.__dmTOs||(window.__dmTOs=[])).push(id);} });
  }

  let dateISO = dayKey();
  let tab = localStorage.getItem(LS_TAB) || 'day';
  let edit = false;
  let supps = SUPPS.slice();
  let meals = MEALS.slice();
  let exs   = EXS.slice();
  let skd   = SKD.slice();
  let skw   = SKW.slice();
  let mantras = MANTRAS.slice();

  function setTab(t){ tab=t; localStorage.setItem(LS_TAB,t); rerender(); }
  function mantraToday(){ const idx = Number(dayKey().replaceAll('-','')) % mantras.length; return mantras[idx] || ''; }

  function rerender(){
    const app = document.getElementById('app'); app.classList.remove('hidden');
    const boot = document.getElementById('boot'); if (boot) boot.remove();
    clear(app);

    // Header
    app.appendChild(h('div',{class:'sticky'},
      h('div',{}, new Date(dateISO).toDateString()),
      h('div',{class:'small', style:{maxWidth:'60%'}}, mantraToday()),
      h('div',{},
        h('button',{class:'btn', onClick:()=>{ shift(-1); }}, '◀'),
        ' ',
        h('button',{class:'btn', onClick:()=>{ shift(1); }}, '▶')
      ),
    ));

    const wrap = h('div',{class:'wrap'}); app.appendChild(wrap);

    // Tabs
    wrap.appendChild(h('div',{class:'tabs'},
      h('button',{class:'tabbtn '+(tab==='day'?'active':''), onClick:()=>setTab('day')}, 'Daily'),
      h('button',{class:'tabbtn '+(tab==='week'?'active':''), onClick:()=>setTab('week')}, 'Weekly'),
      h('button',{class:'tabbtn '+(tab==='settings'?'active':''), onClick:()=>setTab('settings')}, 'Settings')
    ));

    if (tab==='day') renderDay(wrap);
    else if (tab==='week') renderWeek(wrap);
    else renderSettings(wrap);

    wrap.appendChild(h('div',{class:'footer'}, 'Daily & Weekly • Quick Edit • Local storage • Add to Home Screen'));
  }

  function shift(delta){ const d=new Date(dateISO); d.setDate(d.getDate()+delta); dateISO = dayKey(d); rerender(); }

  function currentEvents(){
    const day = getDay(dateISO);
    const phases = getPhases();
    const wkPhase = (phases[weekKey(dateISO)] || 'none');
    return buildEvents({dateISO, supps, meals, exs, skd, skw, overrides: day.overrides||{}, phase: wkPhase});
  }

  function renderDay(root){
    const day = getDay(dateISO);
    const evs = currentEvents();
    const slot = day.slotSize || 30; // default 30
    const windows = groupWindows(evs, slot);

    const top = h('div',{class:'card'},
      h('div',{class:'title'},
        h('span',{}, 'Agenda'),
        h('span',{},
          h('span',{class:'small pill'}, 'Items today: '+evs.length),
          '  ',
          'Window ',
          h('select',{onchange:(e)=>{ const v=Number(e.target.value); setDay(dateISO, prev=>({...prev, slotSize:v})); rerender(); }},
            h('option',{value:30, selected: slot===30}, '30 min'),
            h('option',{value:60, selected: slot===60}, '60 min')
          ),
          ' ',
          h('button',{class:'btn small', onclick:()=>{ edit=!edit; rerender(); }}, edit?'Done editing':'Quick edit'),
          ' ',
          h('button',{class:'btn small', onclick:()=> exportICSFor(dateISO, evs)}, 'Export day (.ics)')
        )
      )
    );

    if (!windows.length){
      top.appendChild(h('div',{class:'empty'}, 'No timed items fell into the 06:00–22:00 window today. Try changing item times in Settings or switch to 60‑min windows.'));
    }

    windows.forEach((s)=>{
      const slotEl = h('div',{class:'slot '+(edit?'edit':''),
        ondragover:(e)=>{ if(edit) e.preventDefault(); },
        ondrop:(e)=>{ if(edit){ const key=e.dataTransfer.getData('text/plain'); if(key){ setDay(dateISO, prev=>({ ...prev, overrides:{ ...(prev.overrides||{}), [key]: fromMin(s.start) } })); rerender(); } } }
      },
        h('div',{class:'timewin'}, fromMin(s.start)+'–'+fromMin(s.end))
      );

      s.items.forEach(it=>{
        const chk = h('input',{type:'checkbox'});
        chk.checked = !!(day.checks||{})[it.key];
        chk.onchange = (e)=> setDay(dateISO, prev=>({ ...prev, checks:{ ...(prev.checks||{}), [it.key]: e.target.checked } }));

        const badge = h('span',{class:'badge'},
          it.kind==='supp'?'Supp': it.kind==='meal'?'Meal': it.kind==='ex'?'Ex':'Skin'
        );

        const row = h('label',{class:'check', draggable:edit, ondragstart:(e)=> e.dataTransfer.setData('text/plain', it.key)},
          chk,
          h('div',{style:{flex:1}},
            h('div',{style:{display:'flex', gap:'8px', alignItems:'center'}},
              badge,
              h('strong',{}, it.time+' — '+it.title)
            ),
            h('div',{class:'small'}, it.desc||'')
          ),
          edit && h('div',{class:'nudge'},
            h('button',{class:'btn small', onclick:()=>{ const t=Math.max(0,Math.min(23*60+59,toMin(it.time)-15)); setDay(dateISO, prev=>({ ...prev, overrides:{ ...(prev.overrides||{}), [it.key]: fromMin(t) } })); rerender(); }}, '−15'),
            h('button',{class:'btn small', onclick:()=>{ const t=Math.max(0,Math.min(23*60+59,toMin(it.time)+15)); setDay(dateISO, prev=>({ ...prev, overrides:{ ...(prev.overrides||{}), [it.key]: fromMin(t) } })); rerender(); }}, '+15')
          )
        );
        slotEl.appendChild(row);
      });

      top.appendChild(slotEl);
    });

    const rem = h('div',{class:'card'},
      h('div',{class:'title'}, h('span',{}, 'Reminders (local)')),
      h('div',{},
        h('button',{class:'btn primary', onclick:enableNoti}, 'Enable notifications'),
        ' ',
        h('button',{class:'btn', onclick:()=> scheduleToday(dateISO, evs)}, 'Schedule reminders for today'),
        h('div',{class:'small', style:{marginTop:'6px'}}, 'Reminders fire while the app is open/installed. For guaranteed background alerts, also use the .ics export.')
      )
    );

    root.appendChild(top);
    root.appendChild(rem);
  }

  function renderWeek(root){
    const wkKeyStr = weekKey(dateISO);
    const phases = getPhases();
    const wkPhase = phases[wkKeyStr] || 'none';

    const card = h('div',{class:'card'},
      h('div',{class:'title'},
        h('span',{}, 'Weekly planner'),
        h('span',{},
          'ACL Phase: ',
          h('select',{onchange:(e)=>{ const copy = {...phases, [wkKeyStr]: e.target.value }; localStorage.setItem(LS_PHASES, JSON.stringify(copy)); rerender(); }},
            h('option',{value:'none', selected:wkPhase==='none'}, 'None'),
            h('option',{value:'phase1', selected:wkPhase==='phase1'}, 'Phase 1'),
            h('option',{value:'phase2', selected:wkPhase==='phase2'}, 'Phase 2'),
            h('option',{value:'phase3', selected:wkPhase==='phase3'}, 'Phase 3')
          )
        )
      )
    );

    const grid = h('div',{class:'grid2'}); card.appendChild(grid);
    for (let i=0;i<7;i++){
      const d=new Date(dateISO); d.setDate(d.getDate()-d.getDay()+i);
      const key=dayKey(d);
      const phaseForThisWeek = (getPhases()[weekKey(key)] || 'none');
      const evs = buildEvents({dateISO:key, supps, meals, exs, skd, skw, overrides:(key===dateISO?(getDay(dateISO).overrides||{}):{}), phase: phaseForThisWeek});

      const col = h('div',{class:'card'},
        h('div',{style:{fontWeight:'700'}}, d.toDateString())
      );
      evs.slice(0,8).forEach(ev=> col.appendChild(h('div',{style:{fontSize:'14px',display:'flex',gap:'6px',alignItems:'center',color:'var(--fuschia)'}},
        h('span',{class:'badge'}, ev.kind==='supp'?'Supp':ev.kind==='meal'?'Meal':ev.kind==='ex'?'Ex':'Skin'),
        h('span',{style:{fontWeight:'700'}}, ev.time),' — ', ev.title
      )));
      if (evs.length>8) col.appendChild(h('div',{class:'small'}, '+ ' + (evs.length-8) + ' more…'));
      grid.appendChild(col);
    }

    root.appendChild(card);
  }

  function renderSettings(root){
    root.appendChild(h('div',{class:'card'},
      h('div',{class:'title'}, 'Mantras'),
      h('textarea',{rows:5, oninput:(e)=>{ mantras = e.target.value.split(/\\n+/).filter(Boolean); }}, mantras.join('\\n')),
      h('div',{class:'small'}, 'One per line. Rotates daily.')
    ));

    function ListEditor(title, items, setItems, fields, addTemplate){
      const card = h('div',{class:'card'}, h('div',{class:'title'}, title));
      const list = h('div',{});
      items.forEach((it, idx)=>{
        const row = h('div',{class:'card'},
          h('div',{class:'grid6'},
            ...fields.map(f=> h('div',{},
              h('div',{class:'small'}, f.label),
              h('input',{value:(it[f.k]??''), oninput:(e)=>{ it[f.k]= f.type==='number' ? Number(e.target.value) : e.target.value; setItems(items); }})
            )),
            h('div',{},
              h('button',{class:'btn small', onclick:()=>{ if (idx>0){ const t=items[idx-1]; items[idx-1]=items[idx]; items[idx]=t; setItems(items); rerender(); }}}, '↑'),' ',
              h('button',{class:'btn small', onclick:()=>{ if (idx<items.length-1){ const t=items[idx+1]; items[idx+1]=items[idx]; items[idx]=t; setItems(items); rerender(); }}}, '↓'),' ',
              h('button',{class:'btn small', onclick:()=>{ items.splice(idx,1); setItems(items); rerender(); }}, '✕')
            )
          )
        );
        list.appendChild(row);
      });
      const addBtn = h('button',{class:'btn', onclick:()=>{ const copy=JSON.parse(JSON.stringify(addTemplate)); copy.id = addTemplate.id + Math.random().toString(36).slice(2,7); items.push(copy); setItems(items); rerender(); }}, '+ Add');
      card.appendChild(list); card.appendChild(addBtn);
      root.appendChild(card);
    }

    ListEditor('Supplements', SUPPS, (v)=>{}, [
      {k:'name',label:'Name'},
      {k:'time',label:'Time'},
      {k:'timing',label:'Timing'},
      {k:'relative',label:'Relative'},
      {k:'notes',label:'Notes'}
    ], {id:'custom-supp-',name:'Custom supplement',time:'09:00',timing:'',relative:'',notes:''});

    ListEditor('Meals & Walks', MEALS, (v)=>{}, [
      {k:'label',label:'Label'},
      {k:'time',label:'Time'},
      {k:'notes',label:'Notes'}
    ], {id:'custom-meal-',label:'Custom meal or walk',time:'11:00',notes:''});

    ListEditor('Exercises', EXS, (v)=>{}, [
      {k:'label',label:'Label'},
      {k:'time',label:'Time'},
      {k:'sets',label:'Sets'},
      {k:'reps',label:'Reps'},
      {k:'unit',label:'Unit'}
    ], {id:'custom-ex-',label:'Custom exercise',time:'14:00',sets:3,reps:10,unit:''});

    ListEditor('Skincare — Daily', SKD, (v)=>{}, [
      {k:'label',label:'Label'},
      {k:'time',label:'Time'}
    ], {id:'custom-skd-',label:'Custom daily step',time:'08:00'});

    ListEditor('Skincare — Weekly', SKW, (v)=>{}, [
      {k:'label',label:'Label'},
      {k:'day',label:'Day (0=Sun)'},
      {k:'time',label:'Time'}
    ], {id:'custom-skw-',label:'Custom weekly step',day:0,time:'19:30'});

    root.appendChild(h('div',{class:'card'},
      h('div',{class:'title'}, 'Maintenance'),
      h('div',{class:'small'}, 'Clear local data if something looks wrong.'),
      h('div',{},
        h('button',{class:'btn', onclick:()=>{ if(confirm('Clear all local data for this app on this device?')){ localStorage.removeItem(LS_KEY); alert('Local data cleared. Reloading…'); location.reload(); } }}, 'Clear local data')
      )
    ));
  }

  rerender();
})();