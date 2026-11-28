/* الوضع التجريبي للوحة الإدارة: admin.html?demo=1
   بيانات وهمية داخل المتصفح فقط، لا اتصال بالباكند ولا كتابة في أي شيت. */
(function(){
'use strict';
var ROLES={admin:{name:'إسلام (مدير)',role:'admin'},support:{name:'سارة (إدارية)',role:'support'},finance:{name:'كريم (مالية)',role:'finance'},teacher:{name:'أ. سمير (أستاذ)',role:'teacher'}};
var role='admin';
function D(d,t,e){return {d:d,t:t,e:e}}
var T={t1:'أ. سمير',t2:'أ. ليلى',t3:'أ. Karim',t4:'أ. نور'};
function g(id,code,lang,lv,age,t,sch,mem,o){return Object.assign({group_id:id,code:code,language:lang,level:lv,age_group:age,teacher_id:t,teacher:T[t]||'',start_date:'2099-01-10',schedule:sch,times_set:sch.length>0,members:mem,saved:Math.max(0,mem-1),closed:false,late_ok:false,status:'open',seats_min:5,seats_max:12,intro_time:'21:15',ad_open_at:'',ad_launch_at:''},o||{})}
var GROUPS=[
 g('g1','EN - A1.1 - DEC26','EN','A1.1','adult','t1',[D(6,'20:00','22:00'),D(1,'20:00','22:00')],9,{ad_open_at:'x',ad_launch_at:'x'}),
 g('g2','FR - B1.2 - DEC26','FR','B1.2','adult','t2',[D(6,'20:00','22:00'),D(3,'18:00','20:00')],5,{ad_open_at:'x'}),
 g('g3','EN - K3 - DEC26','EN','K3','kids','t3',[D(0,'16:00','18:00'),D(2,'16:00','18:00')],7,{ad_open_at:'x',ad_launch_at:'x'}),
 g('g4','FR - A2.1 - DEC26','FR','A2.1','adult','t1',[D(6,'20:00','22:00'),D(4,'20:00','22:00')],12,{closed:true,ad_open_at:'x',ad_launch_at:'x'}),
 g('g5','EN - B2.1 - DEC26','EN','B2.1','adult','t2',[D(5,'10:00','12:00'),D(1,'18:00','20:00')],3),
 g('g6','EN - A1.2 - JAN27','EN','A1.2','adult','',[],4),
 g('g7','FR - K2 - JAN27','FR','K2','kids','t4',[D(3,'16:00','18:00'),D(5,'14:00','16:00')],6,{ad_open_at:'x'}),
 g('g8','EN - B1.1 - JAN27','EN','B1.1','adult','t3',[D(0,'20:00','22:00'),D(2,'20:00','22:00')],8,{ad_open_at:'x',ad_launch_at:'x'})];
function inbox(){return {staff:ROLES[role],payments_pending:3,outreach_pending:4,outreach_urgent:1,stops_pending:2,stops_final:1,avail_missing:3,ad_pending:2,orders_unpaid:5}}
var PAY=[
 {payment_id:'p1',payer:'Amine Bouzid',submitted_at:'2026-11-27T20:10:00',amount:15000,account:'CCP ••• 4821',order_id:'ORD-1042',lines:[{name:'Amine Bouzid',group_code:'EN - A1.1 - DEC26',discount_pct:0}]},
 {payment_id:'p2',payer:'Sara Khelifi',submitted_at:'2026-11-27T11:30:00',amount:27000,account:'CCP ••• 4821',order_id:'ORD-1041',lines:[{name:'Sara Khelifi',group_code:'FR - B1.2 - DEC26',discount_pct:10},{name:'Yacine K.',group_code:'EN - K3 - DEC26',discount_pct:10}]},
 {payment_id:'p3',payer:'Walid Tebbal',submitted_at:'2026-11-26T09:00:00',amount:9000,account:'CCP ••• 7733',order_id:'ORD-1038',lines:[{name:'Walid T.',group_code:'EN - K3 - DEC26',discount_pct:0}]}];
var SVG='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#eee"/><text x="150" y="200" text-anchor="middle" font-size="22" fill="#888">DEMO RECEIPT</text></svg>';
var RC={mime:'image/svg+xml',b64:btoa(SVG)};
var SETS=[{title:'الأسعار',items:[{key:'price_adult',label:'سعر الدورة للكبار (دج)',value:'15000',kind:'number'},{key:'price_kids',label:'سعر الدورة للصغار (دج)',value:'9000',kind:'number'}]},{title:'الأفواج',items:[{key:'seats_min',label:'الحد الأدنى للمشاركين',value:'5',kind:'number'},{key:'seats_max',label:'الحد الأقصى للمشاركين',value:'12',kind:'number'}]},{title:'الخصومات',items:[{key:'discount_tier1_min',label:'أفواج الشريحة 1',value:'2',kind:'number'},{key:'discount_tier1_pct',label:'نسبة الشريحة 1',value:'5',kind:'number'},{key:'discount_tier2_min',label:'أفواج الشريحة 2',value:'4',kind:'number'},{key:'discount_tier2_pct',label:'نسبة الشريحة 2',value:'10',kind:'number'}]}];
function sched(data){var all=GROUPS;if(role==='teacher')all=all.filter(function(x){return x.teacher_id==='t1'});
 data=data||{};all=all.filter(function(x){return (!data.language||x.language===data.language)&&(!data.level||x.level===data.level)&&(!data.teacher_id||x.teacher_id===data.teacher_id)&&(!data.age_group||x.age_group===data.age_group)});
 return {teachers:Object.keys(T).map(function(k){return {id:k,name:T[k]}}),groups:all,contact:{phone:'0699184817',facebook:'BTL School',auto_post:false},slots:['8-10','10-12','12-14','14-16','16-18','18-20','20-22'],scoped:role==='teacher'}}
function times(data){var gp=GROUPS.filter(function(x){return x.group_id===data.group_id})[0]||GROUPS[0],ranked=[],all=[];
 [[6,'20-22',9,9],[1,'20-22',8,9],[3,'18-20',7,9],[4,'20-22',9,9],[5,'10-12',6,9]].forEach(function(r,i){ranked.push({key:'k'+i,d:r[0],slot:r[1],s:r[1].split('-')[0]+':00',free:r[2],total:r[3],missing:r[2]<r[3]?['Nour E.']:[]})});
 [[0,'16-18',4,9],[2,'14-16',3,9]].forEach(function(r,i){all.push({key:'a'+i,d:r[0],slot:r[1],s:r[1].split('-')[0],free:r[2],total:r[3]})});all=all.concat(ranked);
 return {group:gp,members:gp.members,nosave:[{name:'Nour E.'}],ranked:ranked,all:all}}
function h(action,data){
 switch(action){
 case 'staff_inbox':return inbox();
 case 'staff_schedule_board':return sched(data);
 case 'staff_avail_missing':return {list:[{name:'Nour Eddine',group_code:'EN - A1.2 - JAN27',phone:'0550112233'},{name:'Rym Haddad',group_code:'EN - A1.2 - JAN27',phone:'0661445566'},{name:'Walid T.',group_code:'EN - B2.1 - DEC26',phone:'0770998877'}]};
 case 'staff_group_times':return times(data);
 case 'staff_payment_list':return PAY.slice();
 case 'staff_payment_receipt':return RC;
 case 'staff_outreach_list':return [
  {id:'o1',kind:'test_link',urgent:true,since:'2026-11-25T09:00:00',requested_by:'سارة',suggested:'wa',person:{name:'Rym Haddad',phone:'0661445566',telegram:''}},
  {id:'o2',kind:'code_ready',urgent:false,since:'2026-11-27T10:00:00',suggested:'tg',person:{name:'Amine Bouzid',phone:'0555123456',telegram:'123'}},
  {id:'o3',kind:'test_link',urgent:false,since:'2026-11-27T18:00:00',suggested:'wa',person:{name:'Nour Eddine',phone:'0550112233',telegram:'456'}},
  {id:'o4',kind:'code_ready',urgent:false,since:'2026-11-26T12:00:00',suggested:'tg',person:{name:'Lamia B.',phone:'0770334455',telegram:'789'}}];
 case 'staff_stops_list':return {counts:{busy:3,exams:2,price:1},open:[{id:'s1',stop_type:'final',reasons:['price','busy'],resume_when:'',comment:'السعر مرتفع علي حاليا',group_code:'FR - B1.2 - DEC26',created_at:'2026-11-26T10:00:00',person:{name:'Hadjer M.',phone:'0661000111'}},{id:'s2',stop_type:'temp',reasons:['exams'],resume_when:'after_exams',comment:'',group_code:'EN - A1.1 - DEC26',created_at:'2026-11-27T08:00:00',person:{name:'Oussama R.',phone:'0770222333'}}],done:[]};
 case 'staff_src_stats':return {list:[{src:'tg',users:48,paid:21},{src:'fb',users:35,paid:12},{src:'ig',users:22,paid:7},{src:'wa',users:15,paid:9},{src:'-',users:11,paid:3}]};
 case 'staff_accounts_list':return {accounts:[{account_id:'a1',holder_name:'BTL School',label:'الحساب 1',ccp_masked:'•••• 4821',active:true},{account_id:'a2',holder_name:'BTL School 2',label:'الحساب 2',ccp_masked:'•••• 7733',active:true}]};
 case 'staff_settings_get':return SETS;
 case 'staff_notif_list':return {rules:[{event:'pay_ok',label:'تأكيد الدفع',desc:'يصل المشترك عند تأكيد دفعه',aud:'user',aud_label:'للمشتركين',enabled:true,push:true,tg:true,title:'تم تأكيد دفعك',body:'مرحبا {name}، تم تأكيد اشتراكك.',timing:null}],vars:['name','group'],quiet:{from:22,to:7}};
 case 'staff_user_find':return [{id:'u1',name:'Amine Bouzid',phone:'0555123456',telegram:'123'}];
 case 'staff_kpis':return {reg_week:18,reg_target:25,revenue_month:148000,revenue_target:200000,conv:9,conv_target:15};
 case 'staff_logout':return {};
 default:return {saved:0,sent:0,posted:false,reason:'demo'}}}
window.BTLDEMO={
 on:/[?&]demo=1/.test(location.search),
 role:function(r){if(r)role=r;return ROLES[role]},
 roles:ROLES,
 api:function(action,data){return new Promise(function(res){setTimeout(function(){res(JSON.parse(JSON.stringify(h(action,data||{}))))},180)})}
};
})();
