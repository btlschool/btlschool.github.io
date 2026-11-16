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
