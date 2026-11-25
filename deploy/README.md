# رفع موقع Codixa على السيرفر

كل الإعدادات جاهزة في الفولدر ده. المطلوب منك: سيرفر VPS وعليه **Ubuntu 22.04 أو 24.04**، ويكون فيه على الأقل 2 GB رام. ومحتاج كمان دومين.

## 1) وجّه الدومين للسيرفر (Namecheap)
من **Domain List**، اختار **Manage** جنب `codixa.tech`، وبعدين **Advanced DNS**. امسح أي سجلات Parking أو URL Redirect موجودة، وضيف السجلين دول:

| Type | Host | Value |
|---|---|---|
| A Record | `@` | `84.247.177.204` |
| A Record | `www` | `84.247.177.204` |

التفعيل بياخد من دقايق لحد ساعة. تقدر تتأكد بالأمر `nslookup codixa.tech`.

## 2) نزّل الكود على السيرفر من GitHub
```bash
cd /var/www
git clone https://github.com/<ORG>/codixa-web.git codixa
```
(لو الريبو Private، Git هيطلب منك اسم المستخدم وToken. استخدم Fine-grained token صلاحيته **Contents: Read-only** على الريبو ده بس.)

## 3) شغّل سكريبت التجهيز مرة واحدة
```bash
cd /var/www/codixa
sudo bash deploy/setup_server.sh codixa.tech you@email.com
```
السكريبت معمول علشان سيرفر عليه مواقع تانية:
- **مش بيلمس:** إعدادات Nginx بتاعة المواقع التانية، والـ firewall، ونسخ البرامج المتسطبة، وNode الأساسي. وبياخد نسخة احتياطية من `/etc/nginx` قبل أي تعديل.
- **بيستخدم:** port داخلي فاضي ليه لوحده، وقاعدة بيانات `codixa` منفصلة.

والسكريبت بيعمل الآتي:
- يثبّت PostgreSQL وRedis وNginx وffmpeg ومكتبات WeasyPrint وNode.
- يفعّل جدار الحماية، ومش بيفتح غير SSH وHTTP وHTTPS.
- يعمل قاعدة البيانات، ويكتب `backend/.env` بمفاتيح عشوائية جديدة.
- يبني الموقع، ويشغّل Gunicorn وNginx، ويطلّع شهادة HTTPS.
- يجدول تحويل الفيديوهات، وتنظيف الملفات، ونسخة احتياطية كل يوم.

في الآخر بيطبعلك رابط الموقع ورابط لوحة الأدمن السري. بعد كده اعمل حسابك:
```bash
cd /var/www/codixa/backend && sudo -u www-data .venv/bin/python manage.py createsuperuser
```

> **مهم:** خد نسخة من `backend/.env` واحتفظ بيها برة السيرفر. المفتاح `FIELD_ENCRYPTION_KEY` اللي جواه هو الوحيد اللي بيفك تشفير بيانات الدخول بتاعة المشاريع. لو ضاع، البيانات دي مش هتتقري تاني.

## 4) أي تحديث بعد كده
ارفع التعديلات على GitHub، وبعدين على السيرفر (السكريبت بيعمل `git pull` لوحده):
```bash
sudo bash /var/www/codixa/deploy/deploy.sh
```
السكريبت ده بياخد نسخة احتياطية الأول، وبعدين يحدّث المكتبات، ويعمل migrate، ويبني الموقع، ويعيد التشغيل.

## 5) ربط Claude
1. افتح `https://codixa.tech/dashboard/connector` وانسخ الرابط اللي هناك (`https://codixa.tech/mcp`).
2. في Claude ادخل على **Customize ← Connectors ← Add custom connector**، والصق الرابط.
3. اضغط Connect. هتفتحلك صفحة دخول كوديكسا، سجّل بحسابك واضغط **Allow access**.

## إشعارات الإيميل (طلبات الحجز والرسائل)
الموقع بيبعت الإيميلات من حساب Gmail بتاعك عن طريق **App Password**، وده باسوورد مخصوص للموقع ومش باسوورد حسابك.

1. ادخل على حساب Google، وبعدين **Security**، وفعّل **2-Step Verification** لو مش متفعّل.
2. افتح https://myaccount.google.com/apppasswords واعمل App Password باسم `Codixa`. هيظهرلك كود من 16 حرف.
3. على السيرفر افتح `backend/.env` وعدّل السطرين دول (اكتب الكود من غير مسافات):
   ```
   EMAIL_HOST_USER=yourname@gmail.com
   EMAIL_HOST_PASSWORD=abcdabcdabcdabcd
   ```
4. أعد تشغيل الباك إند: `sudo systemctl restart codixa`.
5. من لوحة التحكم ادخل على **إعدادات الموقع**، وبعدين **إشعارات البريد**، واضغط **إرسال رسالة تجريبية**.

لو الإعدادات دي لسه مش موجودة، الإيميلات بتفضل محفوظة في قائمة انتظار، وبتتبعت لوحدها أول ما تضيفها. والإيميلات اللي فشل إرسالها بتتعاد كل دقيقتين، لحد 5 محاولات.

## النسخ الاحتياطية
بتتحفظ كل يوم الساعة 4 الصبح في `/var/backups/codixa`. فيها قاعدة البيانات والصور والفيديو و`.env`، وبيفضل آخر 14 يوم بس. نزّلها على جهازك من وقت للتاني:
```powershell
scp -r root@SERVER_IP:/var/backups/codixa E:\codixa-backups
```

## أوامر مفيدة
| الغرض | الأمر |
|---|---|
| لوج الباك إند | `journalctl -u codixa -f` |
| إعادة تشغيل الباك إند | `sudo systemctl restart codixa` |
| لوج Nginx | `tail -f /var/log/nginx/error.log` |
| رابط الأدمن السري | `grep DJANGO_ADMIN_URL /var/www/codixa/backend/.env` |
