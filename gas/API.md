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
| price_preview | items:[{type:'group',ageGroup:'adult'\|'kids',language} \| {type:'vip',hours:10\|20\|30,language}] | حساب كامل مع الخصم والصافي (السعر من الخادم فقط) |
| offers_now | - | لافتة العرض السارية مع endsAt |

## مشارك (token)
me، logout، logout_all، reg_profile {gender:'M'\|'F', birthYear, languages:['EN','FR']}، reg_add_child {name, gender, birthYear, languages}

### اختبار المستوى (يعمل أيضا بجلسة رابط الاختبار scope=test)
| action | data | النتيجة |
|---|---|---|
| test_start | language:'EN'\|'FR', person_id? (ابنك أو بالغ أضفته بدعوة سارية) | `{test_id, language, audience, total, minutes, remaining_sec, answers, questions:[{no,qid,stage,skill,stem,options[4],audio_text,audio_url,image_hint,image_url}]}`. يستأنف اختبارا جاريا إن وُجد. لا يحتوي مفتاح الجواب أبدا |
| test_answer | test_id, qid, choice (0..3 بحسب ترتيب الاختيارات المعروض) | `{answered, offer_beginner, stop}`. offer_beginner: اعرض نافذة «ابدأ من المبتدئ» (بعد السؤال 6، مرة واحدة). stop (للصغار): أنهِ الاختبار بلطف |
| test_beginner_stop | test_id | نتيجة A1 مبتدئ (فقط بعد عرض النافذة) |
| test_finish | test_id | `{level, beginner, skills:{grammar\|vocab\|reading\|listening:{pct,c,t}}, score, total, answered, stars, timed_out}`. آمن للتكرار. الكبار: A1..B2، الصغار: '1'..'6' |
| test_result | test_id | نفس نتيجة test_finish بعد الانتهاء |

المؤقت يفرضه الخادم (`test_minutes`، مهلة `test_grace_sec`). كل أرقام السحب والعتبات من Settings (`test_*`). لا يُعرض المستوى الفرعي (1/2): يحدده الفوج المتاح.

## أخطاء
bad_phone, bad_name, bad_gender, bad_birth_year, bad_languages, registration_closed, rate_limited, unauthorized, forbidden, bad_credentials, too_many_children, bad_items, price_not_set, bad_language, profile_incomplete, retake_limit, bank_empty, bad_choice, bad_question, test_closed, time_up, not_found, not_allowed, not_finished, maintenance, auth_not_ready
