/**
 * منصة BTL - بناء قاعدة البيانات (آمن للتشغيل أكثر من مرة: يضيف الناقص فقط ولا يمسح بيانات).
 * التشغيل: افتح الدالة setupDatabase من محرر السكربت واضغط Run.
 * الصف الأول في كل ورقة = مفاتيح الأعمدة (إنجليزية). لا تغيّر ترتيبها بعد بدء العمل.
 */
var SCHEMA = {
  Settings:      ['key','value','description'],
  Statuses:      ['code','label_ar','sort','color','auto','active'],
  Users:         ['user_id','phone','name_latin','gender','phone2','role','status','age_group','languages','telegram_id','telegram_username','source','legacy_ref','installed','installed_at','notif_status','platform','created_at','last_login','last_seen','notes'],
  AuthSessions:  ['token_hash','user_id','created_at','expires_at','device','revoked'],
  OtpCodes:      ['phone','code_hash','expires_at','attempts','used','created_at'],
  Questions:     ['qid','language','skill','level','type','stem','options_json','answer_key','audio_url','image_url','active','times_used'],
  Tests:         ['test_id','user_id','language','attempt_no','started_at','deadline_at','finished_at','question_ids_json','answers_json','score','level','sublevel','skills_json','status'],
  Teachers:      ['teacher_id','name','languages','phone','telegram_id','active','notes'],
  Groups:        ['group_id','code','language','level','sublevel','age_group','teacher_id','start_date','end_date','schedule_json','seats_min','seats_max','price','status','telegram_chat_id','created_at'],
  Enrollments:   ['enroll_id','user_id','group_id','status','price','discount_pct','discount_reason','early_renewal','payment_id','created_at','confirmed_by','confirmed_at','sessions_done','sessions_total','stopped_at','stop_type'],
  PayAccounts:   ['account_id','label','ccp_number','rip','holder_name','telegram_chat_id','active','sort'],
  Payments:      ['payment_id','enroll_id','vip_id','user_id','amount','method','account_id','receipt_file_id','status','submitted_at','reviewed_by','reviewed_at','note'],
  VipRequests:   ['vip_id','user_id','language','package_hours','price','times_json','goals_json','goal_text','status','teacher_id','created_at','updated_at'],
  Trials:        ['trial_id','user_id','language','slot','status','created_at'],
  Sessions:      ['session_id','group_id','session_no','date','start','end','teacher_id','recording_url','attendance_json','status'],
  Ratings:       ['rating_id','user_id','group_id','teacher_id','language','level','rating_teacher','rating_curriculum','rating_motivation','rating_admin','rating_benefit','recommend','comment','created_at','source'],
  StopReasons:   ['stop_id','user_id','enroll_id','stop_type','reasons_json','resume_when','comment','created_at'],
  Notifications: ['notif_id','user_id','type','title','body','url','created_at','sent_at','status','error'],
  Devices:       ['device_id','user_id','fcm_token','platform','installed','notif_permission','first_seen','last_seen','active'],
  Staff:         ['staff_id','email','name','role','active','telegram_id','created_at'],
  Audit:         ['ts','actor','action','target','details'],
  Counters:      ['key','value','updated_at'],
  Legacy:        ['legacy_id','source_sheet','phone','name','language','level','status_old','status_new','user_id','imported_at','notes']
};

var DEFAULT_SETTINGS = [
  ['school_name','BTL Languages School','اسم المدرسة'],
  ['whatsapp','0699184817','واتساب المدرسة'],
  ['seats_since_founding','4256','مقاعد منذ التأسيس (يزيد تلقائيا مع كل تسجيل مؤكد)'],
  ['rating_avg','4.2','متوسط تقييم الاستفادة (يتحدث من الأوراق)'],
  ['rating_count','947','عدد المقيّمين'],
  ['recommend_pct','97','نسبة من ينصحون'],
  ['price_adult_level','15000','سعر مستوى الكبار (دج)'],
  ['price_kids_level','9000','سعر مستوى الصغار (دج)'],
  ['vip_10h','15000','باقة VIP 10 ساعات'],
  ['vip_20h','24000','باقة VIP 20 ساعة'],
  ['vip_30h','30000','باقة VIP 30 ساعة'],
  ['discount_two_pct','10','خصم ابنين أو لغتين (%)'],
  ['discount_both_pct','20','خصم ابنين ولغتين (%)'],
  ['early_renewal_pct','5','خصم التجديد المبكر (%)'],
  ['early_renewal_from_progress','70','يظهر خصم التجديد عند هذه النسبة من التقدم (%)'],
  ['test_minutes','15','مدة الاختبار (دقيقة)'],
  ['test_retake_max','3','أقصى عدد لإعادة الاختبار'],
  ['test_retake_days','30','خلال كم يوما'],
  ['group_min','6','أدنى عدد في الفوج'],
  ['group_max','12','أقصى عدد في الفوج (لا يُعرض للعموم)'],
  ['group_start_within_days','15','يبدأ الفوج خلال كم يوما وإلا الاسترجاع'],
  ['next_level_gap_min_days','7','أقل فاصل لبداية المستوى التالي'],
  ['next_level_gap_max_days','15','أقصى فاصل لبداية المستوى التالي'],
  ['invite_expire_hours','48','صلاحية رابط الانضمام لتلغرام (ساعة)'],
  ['registration_open','1','1 = التسجيل مفتوح، 0 = متوقف (مفتاح الطوارئ)'],
  ['payments_open','1','1 = الدفع مفتوح، 0 = متوقف']
];

var DEFAULT_STATUSES = [
  ['new','جديد',1,'#9391FC',1,1],
  ['tested','أنهى الاختبار',2,'#6D63F2',1,1],
  ['interested','مهتم',3,'#E56A00',1,1],
  ['pending_payment','بانتظار التأكيد',4,'#D93A3A',1,1],
  ['subscribed','مشترك',5,'#11804A',0,1],
  ['studying','يدرس',6,'#4136E6',1,1],
  ['level_done','أنهى المستوى',7,'#C4087A',1,1],
  ['stopped','متوقف',8,'#5B5780',0,1]
];

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var created = [];
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); created.push(name); }
    var cols = SCHEMA[name];
    var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    for (var i = 0; i < cols.length; i++) {
      if (have.indexOf(cols[i]) === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue(cols[i]); }
    }
    sh.setFrozenRows(1);
    var last = sh.getLastColumn();
    sh.getRange(1, 1, 1, last).setFontWeight('bold').setBackground('#EEEDFF');
    // كل الأعمدة نص عادي: يمنع تحويل الأرقام والتواريخ والصيغ (حماية من حقن الصيغ)
    sh.getRange(1, 1, sh.getMaxRows(), last).setNumberFormat('@');
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  seedIfEmpty_(ss.getSheetByName('Settings'), DEFAULT_SETTINGS);
  seedIfEmpty_(ss.getSheetByName('Statuses'), DEFAULT_STATUSES);
  Logger.log('تم. أوراق جديدة: ' + (created.join(', ') || 'لا شيء'));
  return created;
}

function seedIfEmpty_(sh, rows) {
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
