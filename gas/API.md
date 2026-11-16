# واجهة BTL API (للواجهة الأمامية)
كل الطلبات: `POST` إلى رابط النشر (/exec) بجسم JSON: `{ "action": "...", "token": "...", "data": {...} }`
الرد: `{ ok: true, result }` أو `{ ok: false, error: "code" }`.

## عامة (بلا token)
| action | data | النتيجة |
|---|---|---|
| ping | - | الإصدار والوقت |
| reg_contact | name, phone, country, device | `{existing:false, token, name, phone}` أو `{existing:true}` (يذهب إلى الدخول) |
| login | phone, country, code, device | `{token, user}` أو خطأ `bad_credentials` موحّد |
| login_request_code | phone, country | `{sent:true}` دائما (يُرسل لتلغرام الموثّق فقط) |
| staff_login | idToken (Google), device | `{token, staff}` |
| invite_open | token (64 حرفا من رابط الاختبار)، device | `{token, user}`: جلسة scope=test للشخص المدعو (تصلح لأفعال الاختبار فقط). خطأ موحّد `invalid_link` |
| price_preview | items:[{type:'group',ageGroup:'adult'\|'kids',language} \| {type:'vip',hours:10\|20\|30,language}] | حساب كامل مع الخصم والصافي (السعر من الخادم فقط) |
| offers_now | - | لافتة العرض السارية مع endsAt |

## مشارك (token)
me، logout، logout_all، reg_profile {gender:'M'\|'F', birthYear, languages:['EN','FR']}، reg_add_child {name, gender, birthYear, languages}

### دعوة شخص بالغ آخر (مشارك)
| action | data | النتيجة |
|---|---|---|
| invite_create | name, gender, birthYear (بالغ فقط), languages, phone (هاتفه الخاص), country, mode:'device'\|'admin' | `{invite_id, person_id, mode, expires_at}`. device: يجري اختباره الآن على جهازك (test_start مع person_id). admin: تتولى الإدارة إرسال رابطه (تلغرام ثم واتساب) |
| invite_list | - | دعواتك: `{invite_id, person_id, name, languages, mode, status: waiting\|opened\|tested\|expired}`. لا تحوي أي نتيجة |
| invite_cancel | invite_id | `{ok:true}` (قبل أن ينهي اختباره) |

رابط الاختبار: `<app_url>t.html#<token>` (الرمز في الجزء بعد # فلا يصل إلى سجلات الخوادم). الصفحة تقرأه وتستدعي invite_open ثم test_start بالجلسة الناتجة. الرابط صالح `test_invite_hours` ويُجدَّد (والقديم يبطل) كلما أعادت الإدارة إرساله. المسجِّل يتلقى إشعارا عند انتهاء اختبار الشخص (دون النتيجة) وتذكيرا بعد `test_remind_hours`.

### اقتراح الفوج (مشارك أو جلسة اختبار)
| action | data | النتيجة |
|---|---|---|
| group_suggest | person_id?, languages? | لكل لغة: `{language, status:'test_required'}` أو `{language, status:'ok', level_code:'B1.1'\|'K3', group:{group_id\|null, code, level, start_date, schedule:[{d,t}], per_week, hours, months, price, price_cents, seats:'available'\|'few', is_new}}`. لا يكتب شيئا. لا تُعرض عبارة «لا يوجد فوج» أبدا: عند عدم وجود فوج مفتوح يُقترح فوج جديد (is_new:true) يُنشأ فعليا عند حجز المقعد |
| group_options | person_id?, language | `{language, suggested_level, groups:[...]}`: الأفواج المفتوحة في المستوى المقترح وما قبله وما بعده (للزر «تغيير الفوج») |

### اختبار المستوى (يعمل أيضا بجلسة رابط الاختبار scope=test)
| action | data | النتيجة |
|---|---|---|
| test_start | language:'EN'\|'FR', person_id? (ابنك أو بالغ أضفته بدعوة سارية) | `{test_id, language, audience, total, minutes, remaining_sec, answers, questions:[{no,qid,stage,skill,stem,options[4],audio_text,audio_url,image_hint,image_url}]}`. يستأنف اختبارا جاريا إن وُجد. لا يحتوي مفتاح الجواب أبدا |
| test_answer | test_id, qid, choice (0..3 بحسب ترتيب الاختيارات المعروض) | `{answered, offer_beginner, stop}`. offer_beginner: اعرض نافذة «ابدأ من المبتدئ» (بعد السؤال 6، مرة واحدة). stop (للصغار): أنهِ الاختبار بلطف |
| test_beginner_stop | test_id | نتيجة A1 مبتدئ (فقط بعد عرض النافذة) |
| test_finish | test_id | `{level, beginner, skills:{grammar\|vocab\|reading\|listening:{pct,c,t}}, score, total, answered, stars, timed_out}`. آمن للتكرار. الكبار: A1..B2، الصغار: '1'..'6' |
| test_result | test_id | نفس نتيجة test_finish بعد الانتهاء |

المؤقت يفرضه الخادم (`test_minutes`، مهلة `test_grace_sec`). كل أرقام السحب والعتبات من Settings (`test_*`). لا يُعرض المستوى الفرعي (1/2): يحدده الفوج المتاح.

## إدارة (token موظف، دور support أو admin)
| action | data | النتيجة |
|---|---|---|
| staff_outreach_list | - | قائمة «بانتظار التواصل»: `{id, kind: test_link\|code_ready, status, person:{name,phone,telegram}, requested_by, since, channel_tried, last_attempt_at, suggested:'tg'\|'wa', urgent}` والأحوج أولا |
| staff_outreach_prepare | outreach_id, channel:'tg'\|'wa' | tg: يرسل عبر البوت `{sent:true}` أو `{sent:false, fallback:'wa'}`. wa: `{wa_url, message}` (رابط واتساب بالرسالة جاهزة، ومعها رابط ربط البوت إن لم يكن مربوطا) |
| staff_outreach_done | outreach_id, note? | `{ok:true}` |

رابط ربط تلغرام الشخصي: `https://t.me/<bot>?start=i_<24 hex>` يربط حساب تلغرام بالشخص بضغطة «ابدأ» دون مشاركة رقم (صالح `tg_link_days`)، ويرسل له رابط اختباره فورا. هذا الربط لا يُعدّ توثيقا للهاتف، فلا تُرسَل إليه رموز الاستعادة.

## أخطاء
bad_phone, bad_name, bad_gender, bad_birth_year, bad_languages, registration_closed, rate_limited, unauthorized, forbidden, bad_credentials, too_many_children, bad_items, price_not_set, bad_language, profile_incomplete, retake_limit, bank_empty, bad_choice, bad_question, test_closed, time_up, not_found, not_allowed, not_finished, invalid_link, same_phone, phone_taken, bad_mode, bad_channel, telegram_not_linked, maintenance, auth_not_ready

## الطلبات والدفع (Orders.gs)
حالات الطلب: `open` (سلة) ← `checkout` (أسعار مجمّدة + مقاعد محجوزة + حساب CCP) ← `paid_pending` (رُفع الوصل) ← `paid` (أكدت الإدارة). الرفض يعيد الطلب إلى `checkout`. المبالغ بالسنتيم. لا تُكشف نتيجة أي شخص.

| الفعل | الصلاحية | المدخل | المخرج |
|---|---|---|---|
| `order_save` | مشارك / جلسة اختبار | `{lines:[{person_id?,language}]}` | عرض الطلب (أسطر بحالة `ready`/`waiting_test`، السعر، الخصم، `can_checkout`) |
| `order_get` | نفسه | — | الطلب النشط أو null (+`account` بعد التجميد) |
| `order_drop_waiting` | نفسه | — | يحذف أسطر من لم يختبروا بعد |
| `order_checkout` | نفسه | — | يجمّد الأسعار، ينشئ الفوج الناقص، يحجز المقاعد، يحدد حساب الدفع |
| `order_cancel` | نفسه | — | إلغاء قبل الوصل ويحرر المقاعد |
| `order_receipt` | نفسه | `{order_id,image_base64,mime}` (jpeg/png/webp ≤ ~2MB) | `{payment_id,status:'pending'}` |
| `code_reveal` | نفسه | `{regenerate?}` | `{code,phone,regenerated}` بعد رفع الوصل فقط |
| `staff_payment_list` | finance | — | الوصولات المعلقة مع أسطرها |
| `staff_payment_receipt` | finance | `{payment_id}` | `{mime,b64}` |
| `staff_payment_review` | finance | `{payment_id,decision:'confirm'|'reject',note?}` | confirm: قيد دخل بالدفتر لكل سطر + تأكيد الاشتراكات + إشعار؛ reject: الملاحظة إلزامية |

أخطاء جديدة: `bad_lines`, `duplicate_line`, `already_enrolled`, `order_locked`, `nothing_ready`, `not_ready`, `line_taken`, `payments_closed`, `no_pay_account`, `bad_file`, `not_allowed`, `code_exists`, `note_required`, `bad_decision`.
المؤقّت `hourlyTick_` (كل ساعة): تذكيرات الدعوات + إنهاء الطلبات غير المدفوعة بعد `order_expire_hours` (72). الطلب `paid_pending` لا ينتهي.
إعدادات جديدة: `session_hours_adult` 2، `session_hours_kids` 1.5، `receipts_folder_id`.

## مركز الإعدادات والنسخ الاحتياطي (Admin.gs)
| الفعل | الصلاحية | المدخل | المخرج |
|---|---|---|---|
| `staff_settings_get` | admin | — | مجموعات `[{id,title,items:[{key,label,value,default,kind}]}]` (kind: number/json/text) بلا أي سر |
| `staff_settings_set` | admin | `{changes:{key:value}}` | `{saved:n}`؛ أخطاء: `bad_changes`, `unknown_setting`, `bad_value`؛ يسجَّل في التدقيق القديم والجديد |

النسخ الاحتياطي: `backupTick_` ضمن `hourlyTick_`؛ ينسخ ملف قاعدة البيانات إلى `BTL-backup-YYYY-MM-DD` مرة يوميا بعد `backup_hour` (3)، ويحذف ما هو أقدم من `backup_keep_days` (14). الإعدادات: `backup_enabled`, `backup_hour`, `backup_keep_days`, `backup_folder_id`. الفشل يُسجَّل في التدقيق (`backup_failed`) ولا يوقف المؤقّت.
