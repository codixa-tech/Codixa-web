// Search-focused content for each indexable page, in Arabic and English.
// Titles stay under ~60 characters and descriptions under ~155 so Google shows them in full.
// Everything here is rendered visibly on the page (never hidden keyword text).

export const PAGES = {
  home: {
    ar: {
      title: 'كوديكسا | شركة برمجة وتطوير أنظمة وتطبيقات و ERP في مصر',
      description:
        'شركة برمجة وتطوير أنظمة ومواقع وتطبيقات موبايل، تنفيذ ERPNext و Frappe، تدريب وتنفيذ IBM Maximo، وكورسات برمجة وذكاء اصطناعي في مصر والسعودية.',
    },
    en: {
      title: 'Codixa | Software Development, ERPNext & IBM Maximo',
      description:
        'Custom software, websites and mobile apps, ERPNext and Frappe implementation, IBM Maximo training, and programming and AI courses in Egypt and Saudi Arabia.',
    },
  },

  'software-development': {
    icon: 'systems',
    serviceType: 'Software development',
    related: { kind: 'project', categories: ['web', 'mobile', 'desktop', 'erp'] },
    ar: {
      title: 'برمجة وتطوير الأنظمة والمواقع والتطبيقات | كوديكسا',
      description:
        'تطوير سيستم مخصص لشركتك: أنظمة إدارة، مواقع ويب، تطبيقات أندرويد و iOS وبرامج ديسكتوب. تحليل وتصميم وبرمجة ونشر ودعم في مصر والسعودية.',
      crumb: 'برمجة وتطوير الأنظمة',
      h1: 'برمجة وتطوير أنظمة وتطبيقات مبنية على طريقة عمل شركتك',
      lead: 'نحلل إجراءاتك ثم نبني النظام الذي يناسبها: نظام إدارة داخلي، موقع أو بوابة ويب، تطبيق موبايل، أو برنامج ديسكتوب، بواجهات عربية وإنجليزية وصلاحيات واضحة لكل مستخدم.',
      offerTitle: 'ماذا نطوّر',
      offers: [
        { t: 'أنظمة إدارة مخصصة', d: 'أنظمة للمخازن والمبيعات والموارد البشرية والعيادات والمدارس والمقاولات، بتقارير ولوحات متابعة.' },
        { t: 'مواقع وبوابات ويب', d: 'مواقع شركات وبوابات عملاء ومنصات ويب سريعة ومتوافقة مع محركات البحث وسهلة التحديث.' },
        { t: 'تطبيقات موبايل', d: 'تطبيقات أندرويد و iOS للعملاء وفرق العمل الميداني، مربوطة بأنظمتك وتعمل بدون إنترنت عند الحاجة.' },
        { t: 'برامج ديسكتوب', d: 'برامج ويندوز وماك ولينكس لنقاط البيع ومحطات العمل، مع قاعدة بيانات محلية ومزامنة.' },
        { t: 'ربط الأنظمة و APIs', d: 'ربط نظامك ببوابات الدفع والأنظمة الحالية وبرامج المحاسبة عبر REST APIs.' },
        { t: 'النشر والدعم', d: 'رفع النظام على سيرفرك أو السحابة، النسخ الاحتياطي، المراقبة، والدعم بعد التشغيل.' },
      ],
      whyTitle: 'لماذا كوديكسا',
      why: [
        { t: 'نبدأ بفهم الإجراءات', d: 'نرسم دورة العمل والمستخدمين والبيانات قبل كتابة أي كود، فيخرج النظام مطابقًا لاحتياجك.' },
        { t: 'نسخة تعمل في كل مرحلة', d: 'دورات تطوير قصيرة مع نسخة تجريبية تستخدمها وتعلّق عليها مبكرًا.' },
        { t: 'عربي وإنجليزي من البداية', d: 'واجهات تدعم العربية واتجاه RTL بشكل كامل، وليس كإضافة لاحقة.' },
      ],
      faqTitle: 'أسئلة شائعة عن تطوير الأنظمة',
      faq: [
        { q: 'كم يستغرق تطوير نظام أو تطبيق؟', a: 'تعتمد المدة على حجم النظام وعدد الموديولات والتكاملات. بعد جلسة تحليل المتطلبات نرسل جدولًا زمنيًا مكتوبًا مقسمًا على مراحل.' },
        { q: 'هل يمكنكم تطوير نظام قائم بدل البدء من الصفر؟', a: 'نعم. نراجع الكود والبنية الحالية أولًا، ثم نقترح التطوير أو إعادة البناء حسب ما هو أنسب تقنيًا وماليًا.' },
        { q: 'ما التقنيات التي تستخدمونها؟', a: 'نستخدم Python و Django و React للويب، و Flutter للموبايل، وقواعد بيانات مثل PostgreSQL، ونختار التقنية حسب المشروع.' },
        { q: 'هل تقدمون دعمًا بعد تسليم النظام؟', a: 'نعم، نقدم النشر وتدريب فريقك والدعم الفني بعد التشغيل.' },
      ],
      cta: { title: 'عندك فكرة نظام أو تطبيق؟', text: 'احكِ لنا عنها، وسنرد بأسئلة وجدول زمني وسعر.', button: 'ابدأ مشروعك' },
    },
    en: {
      title: 'Custom Software, Web & Mobile App Development | Codixa',
      description:
        'Custom software for your business: management systems, websites, Android and iOS apps and desktop software, from analysis to deployment and support.',
      crumb: 'Software development',
      h1: 'Custom software development built around how your business works',
      lead: 'We map your process, then build the system that fits it: an internal management system, a website or web portal, a mobile app or a desktop application, in Arabic and English with clear permissions for every user.',
      offerTitle: 'What we build',
      offers: [
        { t: 'Custom management systems', d: 'Systems for inventory, sales, HR, clinics, schools and contracting, with reports and dashboards.' },
        { t: 'Websites & web portals', d: 'Company sites, customer portals and web platforms that load fast, rank well and are easy to update.' },
        { t: 'Mobile apps', d: 'Android and iOS apps for customers and field teams, connected to your systems and working offline when needed.' },
        { t: 'Desktop software', d: 'Windows, macOS and Linux software for point-of-sale and workstations, with a local database and sync.' },
        { t: 'Integrations & APIs', d: 'Connecting your system to payment gateways, existing software and accounting through REST APIs.' },
        { t: 'Deployment & support', d: 'Deployment to your server or the cloud, backups, monitoring and support after go-live.' },
      ],
      whyTitle: 'Why Codixa',
      why: [
        { t: 'Process first', d: 'We map workflows, users and data before writing code, so the system matches how you actually work.' },
        { t: 'A working build at every stage', d: 'Short development cycles with a demo you can use and comment on early.' },
        { t: 'Arabic and English from day one', d: 'Full Arabic and right-to-left support built in, not added later.' },
      ],
      faqTitle: 'Software development FAQ',
      faq: [
        { q: 'How long does it take to build a system or app?', a: 'It depends on the number of modules and integrations. After a requirements session we send a written, phased timeline.' },
        { q: 'Can you improve an existing system instead of starting over?', a: 'Yes. We review the current code and architecture first, then recommend improving or rebuilding based on what makes technical and financial sense.' },
        { q: 'Which technologies do you use?', a: 'Python, Django and React for web, Flutter for mobile, and databases such as PostgreSQL. We choose the stack per project.' },
        { q: 'Do you provide support after delivery?', a: 'Yes. We handle deployment, train your team and provide technical support after go-live.' },
      ],
      cta: { title: 'Have a system or app in mind?', text: 'Tell us about it and we reply with questions, a timeline and a price.', button: 'Start a project' },
    },
  },

  erpnext: {
    icon: 'erp',
    serviceType: 'ERPNext implementation',
    related: { kind: 'project', categories: ['erp'] },
    ar: {
      title: 'تنفيذ وتخصيص ERPNext و Frappe في مصر والسعودية | كوديكسا',
      description:
        'تنفيذ ERPNext وتخصيصه على إجراءات شركتك: الحسابات والمخازن والمبيعات والموارد البشرية، مع تطبيقات Frappe مخصصة وترحيل البيانات والتدريب.',
      crumb: 'ERPNext و Frappe',
      h1: 'تنفيذ وتخصيص ERPNext و Frappe لشركتك',
      lead: 'ERPNext نظام ERP مفتوح المصدر يغطي الحسابات والمخازن والمبيعات والمشتريات والموارد البشرية والتصنيع. نضبطه على إجراءاتك، ونبني تطبيقات Frappe مخصصة حيث تتوقف الموديولات القياسية.',
      offerTitle: 'خدمات ERPNext',
      offers: [
        { t: 'التنفيذ والإعداد', d: 'إعداد الشركة والفروع ودليل الحسابات والمخازن والصلاحيات حسب هيكل مؤسستك.' },
        { t: 'تخصيص و DocTypes', d: 'حقول ونماذج و DocTypes جديدة ودورات موافقات (Workflows) مكتوبة على مقاس إجراءاتك.' },
        { t: 'تطبيقات Frappe مخصصة', d: 'تطبيقات كاملة على إطار Frappe لعمليات خاصة بنشاطك لا تغطيها الموديولات الجاهزة.' },
        { t: 'التقارير ونماذج الطباعة', d: 'تقارير Query و Script ونماذج طباعة للفواتير وأوامر الشراء بهويتك.' },
        { t: 'ترحيل البيانات والتكامل', d: 'نقل البيانات من الأنظمة القديمة وربط ERPNext بالمتاجر وبوابات الدفع عبر REST API.' },
        { t: 'النشر والترقيات', d: 'تشغيل على Docker أو سيرفر خاص، نسخ احتياطي، وترقيات بين الإصدارات بأمان.' },
      ],
      whyTitle: 'لماذا كوديكسا لـ ERPNext',
      why: [
        { t: 'خبرة عملية على Frappe', d: 'نكتب التخصيصات داخل تطبيقات Frappe منظمة، فتبقى الترقيات ممكنة ولا تتعارض مع النواة.' },
        { t: 'تدريب فريقك', d: 'نُسلّم النظام مع تدريب المستخدمين والمسؤولين حتى يعتمد فريقك على نفسه.' },
        { t: 'عربي بالكامل', d: 'واجهة وتقارير ونماذج طباعة عربية ومتوافقة مع طريقة العمل المحلية.' },
      ],
      faqTitle: 'أسئلة شائعة عن ERPNext',
      faq: [
        { q: 'ما الفرق بين ERPNext و Frappe؟', a: 'Frappe هو إطار العمل المكتوب بلغة Python، و ERPNext هو نظام ERP مبني عليه. التخصيصات المتقدمة تُبنى كتطبيقات Frappe منفصلة.' },
        { q: 'هل ERPNext مناسب للشركات الصغيرة والمتوسطة؟', a: 'نعم، فهو مفتوح المصدر بدون رسوم تراخيص لكل مستخدم، ويمكن البدء بموديولات محددة ثم التوسع.' },
        { q: 'هل يمكن نقل بياناتنا من نظام آخر؟', a: 'نعم، نرحّل العملاء والموردين والأصناف والأرصدة الافتتاحية من ملفات Excel أو من قاعدة البيانات القديمة.' },
        { q: 'هل يدعم ERPNext اللغة العربية؟', a: 'نعم، ونضبط الواجهة ونماذج الطباعة والتقارير بالعربية واتجاه RTL.' },
      ],
      cta: { title: 'تفكر في ERPNext لشركتك؟', text: 'أخبرنا بنشاطك وعدد المستخدمين، وسنقترح خطة التنفيذ.', button: 'اطلب استشارة' },
    },
    en: {
      title: 'ERPNext & Frappe Implementation and Customization | Codixa',
      description:
        'ERPNext implementation and customization: accounting, stock, sales and HR, plus custom Frappe apps, data migration and training in Egypt and Saudi Arabia.',
      crumb: 'ERPNext & Frappe',
      h1: 'ERPNext and Frappe implementation, customized to your business',
      lead: 'ERPNext is an open-source ERP covering accounting, stock, sales, purchasing, HR and manufacturing. We configure it to your processes and build custom Frappe apps where the standard modules stop.',
      offerTitle: 'ERPNext services',
      offers: [
        { t: 'Implementation & setup', d: 'Company, branches, chart of accounts, warehouses and permissions set up to match your organization.' },
        { t: 'Customization & DocTypes', d: 'New fields, forms, DocTypes and approval workflows written around your processes.' },
        { t: 'Custom Frappe apps', d: 'Complete apps on the Frappe framework for operations the standard modules do not cover.' },
        { t: 'Reports & print formats', d: 'Query and script reports, plus branded print formats for invoices and purchase orders.' },
        { t: 'Data migration & integration', d: 'Moving data from legacy systems and connecting ERPNext to stores and payment gateways via REST API.' },
        { t: 'Deployment & upgrades', d: 'Docker or dedicated server deployment, backups and safe version upgrades.' },
      ],
      whyTitle: 'Why Codixa for ERPNext',
      why: [
        { t: 'Hands-on Frappe development', d: 'Customizations live in clean Frappe apps, so upgrades stay possible and the core stays untouched.' },
        { t: 'Your team is trained', d: 'We hand over with user and administrator training so your team runs the system confidently.' },
        { t: 'Fully Arabic', d: 'Arabic interface, reports and print formats that match how local businesses work.' },
      ],
      faqTitle: 'ERPNext FAQ',
      faq: [
        { q: 'What is the difference between ERPNext and Frappe?', a: 'Frappe is the Python web framework; ERPNext is the ERP built on it. Advanced customizations are built as separate Frappe apps.' },
        { q: 'Is ERPNext suitable for small and medium businesses?', a: 'Yes. It is open source with no per-user license fees, and you can start with a few modules and grow.' },
        { q: 'Can you migrate our data from another system?', a: 'Yes. We migrate customers, suppliers, items and opening balances from Excel files or the legacy database.' },
        { q: 'Does ERPNext support Arabic?', a: 'Yes. We configure the interface, print formats and reports in Arabic with right-to-left layout.' },
      ],
      cta: { title: 'Considering ERPNext?', text: 'Tell us about your business and number of users and we will propose an implementation plan.', button: 'Request a consultation' },
    },
  },

  'ibm-maximo': {
    icon: 'maximo',
    serviceType: 'IBM Maximo training and implementation',
    related: { kind: 'training', tracks: ['IBM Maximo'] },
    ar: {
      title: 'تدريب وتنفيذ IBM Maximo و MAS في مصر والسعودية | كوديكسا',
      description:
        'تدريب IBM Maximo و MAS للمستخدمين والمسؤولين: Manage وأوامر العمل والأصول والتكامل و REST APIs والموبايل. التنفيذ عبر شريكنا Smart System.',
      crumb: 'IBM Maximo',
      h1: 'تدريب وتنفيذ IBM Maximo لفرق إدارة الأصول والصيانة',
      lead: 'IBM Maximo منصة لإدارة الأصول والصيانة في المؤسسات. نقدم تدريبًا عمليًا على Maximo و Maximo Application Suite (MAS)، ويتم التنفيذ والتطبيق من خلال شريكنا الاستراتيجي Smart System.',
      offerTitle: 'ما نقدمه في Maximo',
      offers: [
        { t: 'تدريب المستخدمين', d: 'الأصول والمواقع، أوامر العمل، الصيانة الوقائية (PM)، خطط العمل والمخازن بخطوات عملية.' },
        { t: 'تدريب المسؤولين', d: 'إدارة MAS Manage: المؤسسات والمواقع، مجموعات الأمان، Database Configuration، Domains و Escalations.' },
        { t: 'التكامل و REST APIs', d: 'Integration Framework (MIF): Object Structures و Enterprise Services و Publish Channels والربط مع الأنظمة الخارجية.' },
        { t: 'Automation Scripts', d: 'كتابة سكربتات الأتمتة وتخصيص التطبيقات عبر Application Designer.' },
        { t: 'Spatial والموبايل', d: 'ربط Maximo Spatial بـ ArcGIS، وتطبيقات Maximo Mobile لفرق الصيانة الميدانية.' },
        { t: 'التنفيذ عبر Smart System', d: 'تطبيق Maximo على مستوى المؤسسة من خلال شريكنا الاستراتيجي Smart System.' },
      ],
      whyTitle: 'لماذا كوديكسا لتدريب Maximo',
      why: [
        { t: 'خبرة تنفيذ فعلية', d: 'التدريب مبني على مشاريع Maximo نُفذت في مصر والسعودية، لا على الشرائح النظرية.' },
        { t: 'Maximo 7.6 و MAS', d: 'نغطي الإصدار الكلاسيكي و Maximo Application Suite بما فيها MAS 9.' },
        { t: 'محتوى حسب الدور', d: 'برنامج منفصل للمستخدمين والمشرفين والمسؤولين والمطورين.' },
      ],
      faqTitle: 'أسئلة شائعة عن IBM Maximo',
      faq: [
        { q: 'ما هو IBM Maximo؟', a: 'نظام من IBM لإدارة الأصول والصيانة (EAM) يُستخدم لتتبع الأصول وجدولة الصيانة الوقائية وإدارة أوامر العمل وقطع الغيار.' },
        { q: 'ما الفرق بين Maximo 7.6 و MAS؟', a: 'Maximo Application Suite (MAS) هو الجيل الجديد ويعمل على Red Hat OpenShift، ويضم Manage وتطبيقات أخرى، بينما 7.6 هو الإصدار الكلاسيكي.' },
        { q: 'هل التدريب أونلاين أم حضوري؟', a: 'الاثنان متاحان، ويُحدد حسب عدد المتدربين والجهة.' },
        { q: 'من ينفذ مشاريع Maximo؟', a: 'التنفيذ والتطبيق يتم من خلال شريكنا الاستراتيجي Smart System، بينما تقدم كوديكسا التدريب والدعم الفني.' },
      ],
      cta: { title: 'تحتاج تدريب Maximo لفريقك؟', text: 'أخبرنا بعدد المتدربين وأدوارهم والإصدار المستخدم.', button: 'خطّط التدريب' },
    },
    en: {
      title: 'IBM Maximo & MAS Training and Implementation | Codixa',
      description:
        'IBM Maximo and MAS training for users and admins: Manage, work orders, assets, integrations and Mobile. Implementation via our partner Smart System.',
      crumb: 'IBM Maximo',
      h1: 'IBM Maximo training and implementation for asset and maintenance teams',
      lead: 'IBM Maximo is an enterprise platform for asset and maintenance management. We deliver hands-on training on Maximo and Maximo Application Suite (MAS); implementation is delivered through our strategic partner Smart System.',
      offerTitle: 'What we offer for Maximo',
      offers: [
        { t: 'End-user training', d: 'Assets and locations, work orders, preventive maintenance, job plans and inventory, step by step.' },
        { t: 'Administrator training', d: 'MAS Manage administration: organizations and sites, security groups, Database Configuration, domains and escalations.' },
        { t: 'Integration & REST APIs', d: 'Integration Framework (MIF): object structures, enterprise services, publish channels and external system integration.' },
        { t: 'Automation scripts', d: 'Writing automation scripts and customizing applications with Application Designer.' },
        { t: 'Spatial & Mobile', d: 'Maximo Spatial with ArcGIS, and Maximo Mobile for field maintenance teams.' },
        { t: 'Implementation via Smart System', d: 'Enterprise Maximo implementation through our strategic partner Smart System.' },
      ],
      whyTitle: 'Why Codixa for Maximo training',
      why: [
        { t: 'Real implementation experience', d: 'Training draws on Maximo projects delivered in Egypt and Saudi Arabia, not theory slides.' },
        { t: 'Maximo 7.6 and MAS', d: 'We cover the classic release and Maximo Application Suite, including MAS 9.' },
        { t: 'Role-based content', d: 'Separate programs for end users, supervisors, administrators and developers.' },
      ],
      faqTitle: 'IBM Maximo FAQ',
      faq: [
        { q: 'What is IBM Maximo?', a: 'An IBM enterprise asset management (EAM) system used to track assets, schedule preventive maintenance and manage work orders and spare parts.' },
        { q: 'What is the difference between Maximo 7.6 and MAS?', a: 'Maximo Application Suite (MAS) is the new generation running on Red Hat OpenShift and includes Manage and other applications; 7.6 is the classic release.' },
        { q: 'Is the training online or on-site?', a: 'Both are available, depending on the number of trainees and the organization.' },
        { q: 'Who implements Maximo projects?', a: 'Implementation is delivered through our strategic partner Smart System; Codixa provides training and technical support.' },
      ],
      cta: { title: 'Need Maximo training for your team?', text: 'Tell us the number of trainees, their roles and the Maximo version you use.', button: 'Plan the training' },
    },
  },

  training: {
    icon: 'training',
    serviceType: 'Programming, AI and robotics training',
    related: { kind: 'training' },
    ar: {
      title: 'كورسات برمجة وذكاء اصطناعي وروبوتكس للمدارس والشركات',
      description:
        'كورسات عملية في البرمجة و Python والذكاء الاصطناعي والروبوتكس وإنترنت الأشياء وتطوير الويب للمدارس والجامعات والشركات في مصر والسعودية.',
      crumb: 'التدريب',
      h1: 'كورسات برمجة وذكاء اصطناعي وروبوتكس تنتهي بمشروع يعمل',
      lead: 'نصمم ونقدم برامج تدريبية عملية للمدارس والجامعات والخريجين وفرق الشركات. كل برنامج مبني حول مشاريع حقيقية، وقدّمنا أكثر من 35 دورة في مصر والسعودية.',
      offerTitle: 'مسارات التدريب',
      offers: [
        { t: 'البرمجة و Python', d: 'من أساسيات البرمجة حتى كتابة كود Python نظيف ومختبَر.' },
        { t: 'الذكاء الاصطناعي وتعلم الآلة', d: 'تحليل البيانات، نماذج تعلم الآلة، الرؤية الحاسوبية والذكاء التوليدي بمشاريع عملية.' },
        { t: 'الروبوتكس وإنترنت الأشياء', d: 'Arduino والحساسات والمحركات وبناء روبوتات وأجهزة متصلة.' },
        { t: 'تطوير الويب', d: 'HTML و CSS و JavaScript وبناء تطبيقات ويب كاملة بـ Django.' },
        { t: 'IBM Maximo', d: 'تدريب المستخدمين والمسؤولين على منصة إدارة الأصول والصيانة.' },
        { t: 'برامج مخصصة للجهات', d: 'خطة تدريب بالساعات والمحاور والمشروع النهائي حسب الفئة العمرية والمستوى.' },
      ],
      whyTitle: 'لماذا التدريب مع كوديكسا',
      why: [
        { t: 'مشروع في نهاية كل برنامج', d: 'كل متدرب يخرج بمشروع يعمل يمكن عرضه، لا بمعلومات نظرية فقط.' },
        { t: 'خبرة مع جهات متعددة', d: 'قدّمنا برامج ضمن مبادرة رواد مصر الرقمية ومع مدارس ومراكز تدريب في مصر والسعودية.' },
        { t: 'محتوى حسب الفئة', d: 'برامج مختلفة للأطفال وطلاب المدارس والجامعات والمهنيين.' },
      ],
      faqTitle: 'أسئلة شائعة عن التدريب',
      faq: [
        { q: 'هل تقدمون تدريبًا للمدارس؟', a: 'نعم، نقدم برامج برمجة وذكاء اصطناعي وروبوتكس مصممة لطلاب المدارس بمشاريع مناسبة للعمر.' },
        { q: 'هل التدريب حضوري أم أونلاين؟', a: 'حضوري أو أونلاين أو مدمج، حسب الجهة وعدد المتدربين.' },
        { q: 'هل يحصل المتدرب على شهادة؟', a: 'يمكن إصدار شهادة إتمام للبرنامج حسب الاتفاق مع الجهة المنظمة.' },
        { q: 'هل يمكن تصميم برنامج خاص لشركتنا؟', a: 'نعم، نحدد المحاور والساعات والمشروع النهائي حسب احتياج فريقك.' },
      ],
      cta: { title: 'تريد برنامجًا تدريبيًا لجهتك؟', text: 'أخبرنا بالفئة وعدد المتدربين والمجال المطلوب.', button: 'خطّط برنامجًا تدريبيًا' },
    },
    en: {
      title: 'Programming, AI & Robotics Courses for Schools | Codixa',
      description:
        'Hands-on courses in programming, Python, AI, robotics, IoT and web development for schools, universities and companies in Egypt and Saudi Arabia.',
      crumb: 'Training',
      h1: 'Programming, AI and robotics courses that end in a working project',
      lead: 'We design and deliver hands-on programs for schools, universities, graduates and corporate teams. Every program is built around real projects, and we have delivered more than 35 courses in Egypt and Saudi Arabia.',
      offerTitle: 'Training tracks',
      offers: [
        { t: 'Programming & Python', d: 'From programming fundamentals to clean, tested Python.' },
        { t: 'AI & machine learning', d: 'Data analysis, ML models, computer vision and generative AI through practical projects.' },
        { t: 'Robotics & IoT', d: 'Arduino, sensors, motors, and building robots and connected devices.' },
        { t: 'Web development', d: 'HTML, CSS, JavaScript and full web applications with Django.' },
        { t: 'IBM Maximo', d: 'User and administrator training on the asset and maintenance platform.' },
        { t: 'Custom programs', d: 'A plan with hours, topics and a final project tailored to the age group and level.' },
      ],
      whyTitle: 'Why train with Codixa',
      why: [
        { t: 'A project at the end of every program', d: 'Every trainee finishes with a working project to show, not just theory.' },
        { t: 'Experience with many organizations', d: 'Programs delivered within the Digital Egypt Pioneers initiative and with schools and training centers in Egypt and Saudi Arabia.' },
        { t: 'Content per audience', d: 'Different programs for kids, school and university students, and professionals.' },
      ],
      faqTitle: 'Training FAQ',
      faq: [
        { q: 'Do you offer training for schools?', a: 'Yes. We run programming, AI and robotics programs designed for school students with age-appropriate projects.' },
        { q: 'Is the training on-site or online?', a: 'On-site, online or hybrid, depending on the organization and number of trainees.' },
        { q: 'Do trainees receive a certificate?', a: 'A certificate of completion can be issued, as agreed with the organizing institution.' },
        { q: 'Can you design a program for our company?', a: 'Yes. We define topics, hours and the final project around your team’s needs.' },
      ],
      cta: { title: 'Want a training program for your organization?', text: 'Tell us the audience, number of trainees and the field you need.', button: 'Plan a training program' },
    },
  },
};

/** Home page FAQ — visible on the page and published as FAQPage structured data. */
export const HOME_FAQ = {
  ar: [
    { q: 'ما الخدمات التي تقدمها كوديكسا؟', a: 'برمجة وتطوير الأنظمة المخصصة والمواقع وتطبيقات الموبايل والديسكتوب، تنفيذ وتخصيص ERPNext و Frappe، تدريب وتنفيذ IBM Maximo، ومشاريع وتدريبات الذكاء الاصطناعي والروبوتكس.' },
    { q: 'أين تعمل كوديكسا؟', a: 'مقرنا في القاهرة، ونعمل مع عملاء ومؤسسات في مصر والسعودية، حضوريًا وعن بُعد.' },
    { q: 'هل تنفذون ERPNext؟', a: 'نعم، ننفذ ERPNext ونخصصه ونبني تطبيقات Frappe مخصصة، مع ترحيل البيانات وتدريب المستخدمين.' },
    { q: 'هل تقدمون تدريب IBM Maximo؟', a: 'نعم، نقدم تدريب Maximo و MAS للمستخدمين والمسؤولين، والتنفيذ يتم من خلال شريكنا الاستراتيجي Smart System.' },
    { q: 'كيف أبدأ مشروعًا معكم؟', a: 'أرسل تفاصيل مشروعك من نموذج التواصل أو عبر واتساب، وسنرد بأسئلة وجدول زمني وسعر.' },
  ],
  en: [
    { q: 'What services does Codixa offer?', a: 'Custom software, websites, mobile and desktop apps; ERPNext and Frappe implementation and customization; IBM Maximo training and implementation; and AI and robotics projects and training.' },
    { q: 'Where does Codixa work?', a: 'We are based in Cairo and work with clients and organizations in Egypt and Saudi Arabia, on-site and remotely.' },
    { q: 'Do you implement ERPNext?', a: 'Yes. We implement and customize ERPNext and build custom Frappe apps, including data migration and user training.' },
    { q: 'Do you offer IBM Maximo training?', a: 'Yes. We train users and administrators on Maximo and MAS; implementation is delivered through our strategic partner Smart System.' },
    { q: 'How do I start a project with you?', a: 'Send your project details through the contact form or WhatsApp and we reply with questions, a timeline and a price.' },
  ],
};

export const FAQ_TITLE = { ar: 'أسئلة شائعة', en: 'Frequently asked questions' };
