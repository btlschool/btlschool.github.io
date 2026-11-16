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

## أخطاء
bad_phone, bad_name, bad_gender, bad_birth_year, bad_languages, registration_closed, rate_limited, unauthorized, forbidden, bad_credentials, too_many_children, bad_items, price_not_set, maintenance, auth_not_ready
