/**
 * منصة BTL - بناء قاعدة البيانات (آمن للتشغيل أكثر من مرة: يضيف الناقص فقط ولا يمسح بيانات).
 * التشغيل: افتح الدالة setupDatabase من محرر السكربت واضغط Run.
 * الصف الأول في كل ورقة = مفاتيح الأعمدة (إنجليزية). لا تغيّر ترتيبها بعد بدء العمل.
 */
var SCHEMA = {
  Settings:      ['key','value','description'],
  Statuses:      ['code','label_ar','sort','color','auto','active'],
  Users:         ['user_id','phone','name_latin','gender','phone2','role','status','age_group','languages','telegram_id','telegram_username','source','legacy_ref','installed','installed_at','notif_status','platform','created_at','last_login','last_seen','notes','guardian_id','birth_year','phone_verified','code_hash','code_issued_at','failed_logins','locked_until','country'],
  AuthSessions:  ['token_hash','user_id','created_at','expires_at','device','revoked','scope','last_seen'],
  OtpCodes:      ['phone','code_hash','expires_at','attempts','used','created_at'],
  Questions:     ['qid','language','skill','level','type','stem','options_json','answer_key','audio_url','image_url','active','times_used'],
  Tests:         ['test_id','user_id','language','attempt_no','started_at','deadline_at','finished_at','question_ids_json','answers_json','score','level','sublevel','skills_json','status'],
  Teachers:      ['teacher_id','name','languages','phone','telegram_id','active','notes'],
  Groups:        ['group_id','code','language','level','sublevel','age_group','teacher_id','start_date','end_date','schedule_json','seats_min','seats_max','price','status','telegram_chat_id','created_at'],
  Enrollments:   ['enroll_id','user_id','group_id','status','price','discount_pct','discount_reason','early_renewal','payment_id','created_at','confirmed_by','confirmed_at','sessions_done','sessions_total','stopped_at','stop_type','order_id','gross_price','offer_id'],
  PayAccounts:   ['account_id','label','ccp_number','rip','holder_name','telegram_chat_id','active','sort','holder_staff_id','commission_pct','balance_ceiling','is_main','opening_balance','opening_date'],
  Payments:      ['payment_id','enroll_id','vip_id','user_id','amount','method','account_id','receipt_file_id','status','submitted_at','reviewed_by','reviewed_at','note','order_id'],
  VipRequests:   ['vip_id','user_id','language','package_hours','price','times_json','goals_json','goal_text','status','teacher_id','created_at','updated_at','order_id'],
  Trials:        ['trial_id','user_id','language','slot','status','created_at'],
  Sessions:      ['session_id','group_id','session_no','date','start','end','teacher_id','recording_url','attendance_json','status'],
  Ratings:       ['rating_id','user_id','group_id','teacher_id','language','level','rating_teacher','rating_curriculum','rating_motivation','rating_admin','rating_benefit','recommend','comment','created_at','source'],
  StopReasons:   ['stop_id','user_id','enroll_id','stop_type','reasons_json','resume_when','comment','created_at'],
  Notifications: ['notif_id','user_id','type','title','body','url','created_at','sent_at','status','error'],
  Devices:       ['device_id','user_id','fcm_token','platform','installed','notif_permission','first_seen','last_seen','active'],
  Staff:         ['staff_id','email','name','role','active','telegram_id','created_at'],
  Audit:         ['ts','actor','action','target','details'],
  Counters:      ['key','value','updated_at'],
  Ledger:        ['entry_id','entry_date','period','account_id','type','category','method','amount','status','ref_type','ref_id','user_id','counterparty','note','receipt_file_id','transfer_pair_id','reverses_entry_id','created_by','created_at','confirmed_by','confirmed_at'],
  Categories:    ['code','label_ar','type','sort','active'],
  Budgets:       ['period','category','amount','note'],
  Reconciliations:['recon_id','account_id','period','book_balance','actual_balance','diff','note','by','at'],
  Orders:        ['order_id','payer_user_id','status','gross','discount','net','discount_json','lines_json','account_id','payment_id','created_at','updated_at','expires_at'],
  Offers:        ['offer_id','name','pct','scope_type','scope_value','starts_at','ends_at','active','banner_text','created_by','created_at'],
  TestInvites:   ['invite_id','token_hash','order_id','user_id','phone','created_by','created_at','expires_at','used_at','reminders_sent','status'],
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
  ['discount_tier1_min','2','أقل عدد أفواج جماعية في الدفعة الواحدة للخصم الأول'],
  ['discount_tier1_pct','5','نسبة الخصم الأول (%)'],
  ['discount_tier2_min','4','أقل عدد أفواج للخصم الثاني'],
  ['discount_tier2_pct','10','نسبة الخصم الثاني (%)'],
  ['test_questions','24','عدد أسئلة اختبار المستوى'],
  ['test_invite_hours','24','صلاحية رابط الاختبار المرسل لشخص آخر (ساعة)'],
  ['test_remind_hours','2,24','تذكير صاحب الرابط بعد كم ساعة (قائمة مفصولة بفاصلة)'],
  ['order_expire_hours','72','انتهاء صلاحية طلب لم يُدفع (ساعة)'],
  ['adult_min_age','15','أقل عمر للكبار'],
  ['kids_min_age','8','أقل عمر للصغار دون تنبيه'],
  ['kids_floor_age','5','أقل عمر يُقبل استثناءً مع تنبيه مرافقة الوالد'],
  ['max_age','90','أكبر عمر مقبول'],
  ['session_days','365','مدة بقاء الجلسة (يوم) وتتجدد مع الاستعمال'],
  ['max_sessions_per_user','5','أقصى عدد أجهزة مسجلة لحساب واحد'],
  ['login_max_fails','5','عدد المحاولات الخاطئة قبل القفل المؤقت'],
  ['login_lock_minutes','15','مدة القفل المؤقت (دقيقة)'],
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
  ['commission_pct_default','5','عمولة صاحب الحساب الافتراضية على كل مدخول (%)'],
  ['balance_ceiling_default','0','سقف رصيد الحساب الافتراضي قبل التحويل للحساب الرئيسي (دج) - يضبط لكل حساب'],
  ['approval_threshold','0','مبلغ المصروف الذي يحتاج موافقة الإدارة (0 = غير مفعل)'],
  ['registration_open','1','1 = التسجيل مفتوح، 0 = متوقف (مفتاح الطوارئ)'],
  ['payments_open','1','1 = الدفع مفتوح، 0 = متوقف']
];

var DEFAULT_CATEGORIES = [
  ['fees_adult','رسوم دروس الكبار','income',1,1],
  ['fees_kids','رسوم دروس الصغار','income',2,1],
  ['fees_vip','رسوم دروس VIP','income',3,1],
  ['other_income','مداخيل أخرى','income',4,1],
  ['wages','أجور الأساتذة','expense',10,1],
  ['marketing','تسويق وإعلان','expense',11,1],
  ['admin','مصاريف إدارية','expense',12,1],
  ['tools','اشتراكات وأدوات (Zoom وغيرها)','expense',13,1],
  ['bank_fees','رسوم بنكية وبريدية','expense',14,1],
  ['commission','عمولة صاحب الحساب','expense',15,1],
  ['refund','استرجاع رسوم','expense',16,1],
  ['other_expense','مصاريف أخرى','expense',17,1],
  ['transfer','تحويل بين الحسابات','transfer',20,1],
  ['adjustment','تسوية','adjustment',21,1],
  ['opening','رصيد افتتاحي','opening',22,1]
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
  seedIfEmpty_(ss.getSheetByName('Categories'), DEFAULT_CATEGORIES);
  removeSettings_(ss.getSheetByName('Settings'), OBSOLETE_SETTINGS);
  ensureSettings_(ss.getSheetByName('Settings'), DEFAULT_SETTINGS);
  Logger.log('تم. أوراق جديدة: ' + (created.join(', ') || 'لا شيء'));
  return created;
}

/** إعدادات ألغيت بقرار جديد (الخصم صار بحسب عدد الأفواج في دفعة واحدة). */
var OBSOLETE_SETTINGS = ['discount_two_pct', 'discount_both_pct'];

function removeSettings_(sh, keys) {
  for (var r = sh.getLastRow(); r >= 2; r--) {
    if (keys.indexOf(String(sh.getRange(r, 1).getValue())) !== -1) sh.deleteRow(r);
  }
}

function seedIfEmpty_(sh, rows) {
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/** يضيف مفاتيح الإعدادات الجديدة فقط دون المساس بالقيم الموجودة. */
function ensureSettings_(sh, rows) {
  var have = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var add = rows.filter(function (r) { return have.indexOf(r[0]) === -1; });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
}
