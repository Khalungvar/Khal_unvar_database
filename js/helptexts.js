// הסברים לגבאים — איין פרק פאר יעדן מסך (❓). עברית / אידיש / ענגליש.
// {{key}} = דער נאמען פונעם קנעפל אויפן אתר (פון i18n), אין דער שפראך פונעם גבאי — אזוי שטימט עס אלעמאל.
// סינטאקס: "### " = א קליינע קעפל, "1. " = א שריט, "- " = א פונקט, **…** = פעט.
// א מנהל קען טוישן יעדן טעקסט (אדמין ← עריכת הסברים); דאס ווערט געהאלטן אין לשונית HelpTexts.

export const HELP = [
  {
    id: 'search', views: ['lobby', 'contacts'],
    title: { he: 'חיפוש אדם והוספת איש קשר חדש', yi: 'זוכן א מענטש און צולייגן א נייעם קאנטאקט', en: 'Finding a person and adding a new contact' },
    body: {
      he: `### למצוא אדם
1. כתוב בתיבת החיפוש למעלה חלק מהשם (באידיש או באנגלית), טלפון, מייל או מספר ID של איש הקשר.
2. לחץ על השורה שלו — הכרטיס נפתח.
- לצמצום: בחר תגית, אזור או מוסד.
- לא מוצא? סמן {{inclInactive}} — יופיעו גם מי שסומנו כלא פעילים.
- בחרת מוסד בלובי? תראה רק את האנשים שלו. נכנסת ל"כלל מוסדות אונגוואר"? תראה את כולם.
### להוסיף אדם חדש
1. תמיד חפש קודם אם האדם כבר נמצא, כדי לא ליצור כפילות.
2. לא נמצא? לחץ {{newContact}}.
3. כתוב שם פרטי ושם משפחה (חובה), ומלא מה שידוע: שם באנגלית, כתובת (בארה"ב היא נשלמת לבד תוך כדי הקלדה), טלפונים, מייל, פרטי האישה, תגיות.
4. לחץ {{save}}.
- המערכת שואלת "להמשיך?" — יש כבר מישהו עם אותו שם או טלפון. בדוק: יכולים להיות שני אנשים שונים עם אותו שם. אם זה לא אותו אדם — שמור. אם זה אותו אדם — בטל, ועדכן את הכרטיס הקיים.`,
      yi: `### טרעפן א מענטש
1. שרייבט אינעם זוך-פעלד אויבן א טייל פונעם נאמען (אידיש אדער ענגליש), א טעלעפאן, אן אימעיל אדער דעם ID נומער פונעם קאנטאקט.
2. קליקט אויף זיין שורה — דער כרטיס עפנט זיך.
- צו פארקלענערן: קלייבט א טעג, א געגנט אדער א מוסד.
- טרעפט נישט? צייכנט {{inclInactive}} — עס ווייזן זיך אויך די וואס זענען געצייכנט ווי נישט אקטיוו.
- האט איר אויסגעקליבן א מוסד אין לאבי? איר זעט נאר זיינע מענטשן. "כלל מוסדות אונגוואר" — איר זעט אלעמען.
### צולייגן א נייעם מענטש
1. זוכט אלעמאל קודם צי דער מענטש איז שוין דא, כדי נישט צו מאכן צוויי כרטיסן.
2. נישטא? דריקט {{newContact}}.
3. שרייבט ערשטע און לעצטע נאמען (מוז), און פילט אויס וואס מ'ווייסט: ענגליש נאמען, אדרעס (אין אמעריקע פילט זי זיך אויס אליין ביים שרייבן), טעלעפאנען, אימעיל, די פרוי, טעג'ס.
4. דריקט {{save}}.
- עס פרעגט "ווייטער?" — ס'איז שוין דא איינער מיטן זעלבן נאמען אדער טעלעפאן. קוקט: עס קענען זיין צוויי באזונדערע מענטשן מיטן זעלבן נאמען. איז עס נישט דער זעלבער — היט אפ. איז עס יא דער זעלבער — בטל'ט, און דערהיינטיגט דעם כרטיס וואס איז שוין דא.`,
      en: `### Find a person
1. Type in the search box at the top part of the name (Yiddish or English), a phone, an email or the contact's ID number.
2. Click his row — the card opens.
- To narrow down: pick a tag, an area or an organization.
- Can't find him? Check {{inclInactive}} — people marked inactive show too.
- Picked an organization in the lobby? You see only its people. "Klal Mosdos Ungvar" shows everyone.
### Add a new person
1. Always search first — maybe he's already there. This avoids duplicate cards.
2. Not there? Press {{newContact}}.
3. Type first and last name (required) and fill in what you know: English name, address (in the US it completes itself as you type), phones, email, the wife, tags.
4. Press {{save}}.
- It asks "Continue?" — someone with the same name or phone already exists. Check: two different people can have the same name. Not the same person — save. The same person — cancel and update the existing card.`,
    },
  },
  {
    id: 'card', views: ['contacts'],
    title: { he: 'הכרטיס של אדם: פרטים, משפחה, תמונה', yi: 'דער כרטיס פון א מענטש: פרטים, משפחה, בילד', en: "A person's card: details, family, photo" },
    body: {
      he: `לחץ על שם של אדם כדי לפתוח את הכרטיס. למעלה לשוניות (פרטים, משפחה, נדבות, מוסד, קוויטל, תגיות נוספות, היסטוריה), ולמטה כפתורים.
### לשנות פרטים
1. לחץ {{edit}}.
2. תקן מה שצריך.
3. לחץ {{save}}.
- כל שינוי נרשם. לראות מי שינה מה ומתי — פתח את לשונית ההיסטוריה.
### להוסיף קשר משפחתי
1. לחץ {{edit}} ורד ל"משפחה".
2. בחר סוג קשר (בן, בת, חתן…) ובחר את האדם.
3. לחץ {{save}}. הצד השני נרשם לבד (אצל האבא ייכתב "אב").
- פרטי האישה (שם, נייד, האם היא חלק מנשי אונגוואר) — מלא בכרטיס של הבעל.
### תמונה
- אין תמונה: לחץ 📷 ובחר תמונה מהמחשב.
- יש תמונה: לחץ עליה כדי להגדיל, ושם לחץ {{photoChange}} או {{photoRemove}}.
### שני כרטיסים לאותו אדם — מיזוג
1. באחד הכרטיסים לחץ {{cardMergeBtn}}.
2. כתוב שם או טלפון ובחר את הכרטיס השני.
3. בכל שדה ששונה — בחר את הערך הנכון. (תגיות, טלפונים ומיילים מתאחדים לבד.)
4. לחץ {{cardMergeBtn}}. המיזוג נשלח למנהל לאישור.
### אדם שלא רלוונטי יותר
- הפסיק לבוא? לחץ {{deactivate}} — הכל נשמר, הוא רק מוסתר.
- צריך למחוק ממש? לחץ {{cardDelete}} וכתוב למה. המחיקה נשלחת למנהל לאישור.`,
      yi: `קליקט אויפן נאמען פון א מענטש צו עפענען דעם כרטיס. אויבן זענען לשוניות (פרטים, משפחה, נדבות, ארגון, קוויטל, תגיות נוספות, היסטאריע), און אונטן קנעפלעך.
### טוישן פרטים
1. דריקט {{edit}}.
2. פאררעכט וואס מ'דארף.
3. דריקט {{save}}.
- יעדע ענדערונג ווערט פארשריבן. צו זען ווער האט וואס געטוישט און ווען — עפנט די לשונית היסטאריע.
### צולייגן א משפחה-קשר
1. דריקט {{edit}} און גייט אראפ צו "משפחה".
2. קלייבט דעם סארט קשר (זון, טאכטער, איידעם…) און דעם מענטש.
3. דריקט {{save}}. די צווייטע זייט ווערט אליין פארשריבן (ביים טאטן שטייט "טאטע").
- די פרטים פון דער פרוי (נאמען, סעלפאן, צי זי איז פון נשי אונגוואר) — פילט אויס אינעם כרטיס פונעם מאן.
### בילד
- נישטא קיין בילד: דריקט 📷 און קלייבט א בילד פונעם קאמפיוטער.
- ס'איז דא א בילד: קליקט דערויף עס צו פארגרעסערן, און דארט דריקט {{photoChange}} אדער {{photoRemove}}.
### צוויי כרטיסן פאר דעם זעלבן מענטש — מערדזשן
1. אין איינעם פון די כרטיסן דריקט {{cardMergeBtn}}.
2. שרייבט א נאמען אדער טעלעפאן און קלייבט דעם צווייטן כרטיס.
3. ביי יעדן פעלד וואס איז אנדערש — קלייבט דאס ריכטיגע. (טעג'ס, טעלעפאנען און אימעילס ווערן אליין צוזאמגעשטעלט.)
4. דריקט {{cardMergeBtn}}. דאס מערדזשן גייט צום מנהל צו באשטעטיגן.
### א מענטש וואס איז מער נישט שייך
- קומט מער נישט? דריקט {{deactivate}} — אלעס בלייבט, ער איז נאר באהאלטן.
- מ'דארף אים טאקע אויסמעקן? דריקט {{cardDelete}} און שרייבט פארוואס. עס גייט צום מנהל צו באשטעטיגן.`,
      en: `Click a person's name to open the card. Tabs at the top (details, family, donations, organization, kvitel, more tags, history), buttons at the bottom.
### Change details
1. Press {{edit}}.
2. Fix what's needed.
3. Press {{save}}.
- Every change is logged. To see who changed what and when — open the history tab.
### Add a family relation
1. Press {{edit}} and go down to "Family".
2. Pick the relation (son, daughter, son-in-law…) and the person.
3. Press {{save}}. The other side is recorded by itself (the father shows "father").
- The wife's details (name, cell, whether she is part of Neshei Ungvar) — fill them in on the husband's card.
### Photo
- No photo: press 📷 and choose a picture from the computer.
- Has a photo: click it to enlarge, then press {{photoChange}} or {{photoRemove}}.
### Two cards for the same person — merge
1. On one of the cards press {{cardMergeBtn}}.
2. Type a name or phone and pick the other card.
3. For each field that differs — pick the right value. (Tags, phones and emails are combined by themselves.)
4. Press {{cardMergeBtn}}. The merge goes to an admin for approval.
### Someone no longer relevant
- Stopped coming? Press {{deactivate}} — everything stays, he's just hidden.
- Really needs deleting? Press {{cardDelete}} and write why. It goes to an admin for approval.`,
    },
  },
  {
    id: 'tags', views: ['contacts', 'lists'],
    title: { he: 'תגיות', yi: 'טעג\'ס (תגיות)', en: 'Tags' },
    body: {
      he: `תגית אומרת לאן אדם שייך: בית מדרש, מוסד, חבורה או קבוצה. לפי התגיות מחפשים, בונים רשימות ושולחים מכתבים, מיילים ו-SMS — לכן חשוב לסמן נכון.
### איך זה בנוי
- התגיות מסודרות כמו עץ, בשלוש קבוצות: (1) מוסדות, בית מדרש, חבורות · (2) משפחת ותלמידי רבותינו · (3) אנ"ש, תורמים, רבנים, ידידים.
- כל קבוצה נפתחת לענפים (למשל: מוסדות ← בית מדרש ← תפקיד).
- "רשימה ישנה" — תגיות מהרשימות הישנות, להתמצאות בלבד.
### להוסיף תגית לאדם
1. בכרטיס לחץ {{edit}} ורד לתגיות.
2. פתח את הענף הנכון וסמן ☑. אפשר כמה בבת אחת.
3. לחץ {{save}}.
### המצב של התגית
- **פעיל** — שייך עכשיו. תגית חדשה נכנסת כך.
- **יוצא** — עזב. אל תמחק את התגית — שנה את המצב ל"יוצא", כך נשמר שהיה שייך ומתי.
- **⚠ לא נבדק** — תגית שהגיעה מהרשימות הישנות. עבור על הכרטיס, בחר מצב לכל תגית אדומה (או ✕ למחיקה), וכשהכל תקין לחץ {{tgCheckYes}}.
- תורם שלא תרם 5 שנים עובר לבד ל"יוצא".
- אנשי הישיבה (תלמיד, הורה, צוות) מתעדכנים לבד מאתר הישיבה.
### למי שולחים — {{tgSend}}
- סמן {{tgSend}} ליד מוסד, כדי שהאדם יקבל ממנו מכתבים, מיילים ו-SMS.
- ברשימה בחר {{tgSendOnly}} — ותקבל רק את המסומנים.
### {{otTitle}} (למוסד אחד)
- תגיות ששייכות רק למוסד אחד (למשל בישיבה: "מחזור תשס"ה").
- לחץ {{edit}} ← {{otTitle}} ← לחץ על תגית.
### חסרה תגית?
- לחץ {{newTag}} וכתוב את השם. הבקשה נשלחת למנהל, ואחרי אישור התגית מופיעה.`,
      yi: `א טעג זאגט וואו א מענטש געהערט: א ביהמ"ד, א מוסד, א חבורה אדער א גרופע. לויט די טעג'ס זוכט מען, מאכט מען רשימות, און שיקט מען בריוו, אימעילס און SMS — דערפאר איז וויכטיג צו צייכענען ריכטיג.
### ווי עס איז געבויט
- די טעג'ס זענען אויסגעשטעלט ווי א בוים, אין דריי גרופעס: (1) מוסדות, ביהמ"ד, חבורות · (2) משפחת און תלמידי רבותינו · (3) אנ"ש, נדבנים, רבנים, ידידים.
- יעדע גרופע עפנט זיך אויף צווייגן (למשל: מוסדות ← א ביהמ"ד ← א תפקיד).
- "אלטע רשימה" — טעג'ס פון די אלטע רשימות, נאר צו וויסן.
### צולייגן א טעג צו א מענטש
1. אינעם כרטיס דריקט {{edit}} און גייט אראפ צו די טעג'ס.
2. עפנט דעם ריכטיגן צווייג און צייכנט ☑. מ'קען עטליכע אויף איינמאל.
3. דריקט {{save}}.
### דער מצב פון א טעג
- **פעיל** — געהערט יעצט. א נייע טעג קומט אריין אזוי.
- **יוצא** — איז אוועק. מעקט נישט אויס די טעג — טוישט דעם מצב אויף "יוצא", אזוי בלייבט אז ער האט געהערט און ווען.
- **⚠ לא נבדק** — א טעג פון די אלטע רשימות. גייט דורך דעם כרטיס, קלייבט א מצב פאר יעדע רויטע טעג (אדער ✕ אויסמעקן), און ווען אלעס שטימט דריקט {{tgCheckYes}}.
- א נדבן וואס האט 5 יאר נישט געגעבן ווערט אליין "יוצא".
- די מענטשן פון דער ישיבה (תלמיד, הורה, צוות) ווערן אליין דערהיינטיגט פונעם אתר פון דער ישיבה.
### צו וועמען מ'שיקט — {{tgSend}}
- צייכנט {{tgSend}} ביי א מוסד, אז דער מענטש זאל באקומען פון אים בריוו, אימעילס און SMS.
- אין א רשימה קלייבט {{tgSendOnly}} — און איר באקומט נאר די געצייכנטע.
### {{otTitle}} (פאר איין מוסד)
- טעג'ס וואס געהערן נאר צו איין מוסד (למשל אין דער ישיבה: "מחזור תשס"ה").
- דריקט {{edit}} ← {{otTitle}} ← קליקט אויף א טעג.
### פעלט א טעג?
- דריקט {{newTag}} און שרייבט דעם נאמען. די בקשה גייט צום מנהל, און נאכן באשטעטיגן ווייזט זיך די טעג.`,
      en: `A tag says where a person belongs: a beis medrash, an institution, a group. Searches, lists, letters, emails and SMS all go by the tags — so mark them correctly.
### How it's built
- Tags are arranged like a tree, in three groups: (1) institutions, beis medrash, groups · (2) family and students of our Rebbes · (3) anash, donors, rabbis, friends.
- Each group opens into branches (e.g. institutions → a beis medrash → a role).
- "Old list" — tags from the old lists, for reference only.
### Add a tag to a person
1. On the card press {{edit}} and go down to the tags.
2. Open the right branch and check ☑. You can check several at once.
3. Press {{save}}.
### A tag's status
- **Active** — belongs now. A new tag starts this way.
- **Left** — he left. Don't delete the tag — change its status to "left", so it stays known that he belonged and when.
- **⚠ Unchecked** — a tag from the old lists. Go over the card, pick a status for each red tag (or ✕ to delete), and when all is right press {{tgCheckYes}}.
- A donor who hasn't given for 5 years becomes "left" by itself.
- Yeshiva people (student, parent, staff) are updated by themselves from the yeshiva site.
### Who gets mail — {{tgSend}}
- Check {{tgSend}} next to an institution so the person gets its letters, emails and SMS.
- In a list choose {{tgSendOnly}} — you get only the checked ones.
### {{otTitle}} (for one institution)
- Tags that belong to one institution only (e.g. in the yeshiva: "class of 5765").
- Press {{edit}} → {{otTitle}} → click a tag.
### A tag is missing?
- Press {{newTag}} and type the name. The request goes to an admin; once approved the tag appears.`,
    },
  },
  {
    id: 'donations', views: ['donations', 'donhub', 'campaign'],
    title: { he: 'נדבות: אחת או הרבה בבת אחת', yi: 'נדבות: איינע אדער אסאך אויף איינמאל', en: 'Donations: one, or many at once' },
    body: {
      he: `### להכניס נדבה
1. לחץ {{newDonation}} (או בכרטיס של האדם ← נדבות).
2. בחר את התורם. לא במאגר? כתוב את השם.
3. כתוב סכום ובחר מטבע (דולר, שקל, אירו, ליש"ט — מומר לבד לדולר לפי שער היום).
4. בחר תאריך, על מה (קמפיין / הקדשה) ולאיזה מוסד.
5. שולם? סמן {{scPaid}} ובחר איך: צ'ק (כתוב מספר), מזומן או כרטיס אשראי (רק 4 ספרות אחרונות).
6. לחץ {{save}}.
- התחייבות שעוד לא שולמה: השאר {{scPaid}} ריק. כשהוא משלם — פתח את הנדבה, סמן ושמור.
- קבלה: לחץ "🧾 קבלה" או "✉" ישר מטופס הנדבה.
- צריך למחוק נדבה? לחץ 🗑 — הבקשה נשלחת למנהל.
### הרבה נדבות בבת אחת (למשל אחרי דינר)
1. לחץ {{campaignBtn}}.
2. למעלה, ב-{{campaignCommon}}, בחר קמפיין ותאריך פעם אחת.
3. בכל שורה בחר תורם וכתוב סכום. לעוד תורם — {{addRow}}.
4. לחץ {{saveAll}}.`,
      yi: `### אריינלייגן א נדבה
1. דריקט {{newDonation}} (אדער אינעם כרטיס פונעם מענטש ← נדבות).
2. קלייבט דעם נדבן. נישט אין מאגר? שרייבט דעם נאמען.
3. שרייבט דעם סכום און קלייבט די מטבע (דאלאר, שקל, אייראָ, פונט — ווערט אליין איבערגערעכנט אויף דאלאר לויטן קורס פון יענעם טאג).
4. קלייבט א דאטום, פאר וואס (קאמפיין / הקדשה) און פאר וועלכן מוסד.
5. באצאלט? צייכנט {{scPaid}} און קלייבט ווי: טשעק (שרייבט דעם נומער), קעש אדער קרעדיט קארד (נאר די לעצטע 4 ציפערן).
6. דריקט {{save}}.
- א התחייבות וואס איז נאך נישט באצאלט: לאזט {{scPaid}} ליידיג. ווען ער צאלט — עפנט די נדבה, צייכנט און היט אפ.
- א קבלה: דריקט "🧾 קבלה" אדער "✉" גלייך פון דער נדבה.
- מ'דארף אויסמעקן א נדבה? דריקט 🗑 — די בקשה גייט צום מנהל.
### אסאך נדבות אויף איינמאל (למשל נאך א דינער)
1. דריקט {{campaignBtn}}.
2. אויבן, ביי {{campaignCommon}}, קלייבט דעם קאמפיין און דאטום איינמאל.
3. אין יעדע שורה קלייבט א נדבן און שרייבט א סכום. נאך א נדבן — {{addRow}}.
4. דריקט {{saveAll}}.`,
      en: `### Enter a donation
1. Press {{newDonation}} (or on the person's card → donations).
2. Pick the donor. Not in the database? Type the name.
3. Type the amount and pick the currency (dollar, shekel, euro, pound — converted to dollars by that day's rate by itself).
4. Pick the date, what for (campaign / dedication) and which institution.
5. Paid? Check {{scPaid}} and pick how: check (type its number), cash or credit card (last 4 digits only).
6. Press {{save}}.
- A pledge not yet paid: leave {{scPaid}} empty. When he pays — open the donation, check it and save.
- A receipt: press "🧾 Receipt" or "✉" right from the donation.
- Need to delete a donation? Press 🗑 — the request goes to an admin.
### Many donations at once (e.g. after a dinner)
1. Press {{campaignBtn}}.
2. At the top, under {{campaignCommon}}, pick the campaign and date once.
3. In each row pick a donor and type an amount. Another donor — {{addRow}}.
4. Press {{saveAll}}.`,
    },
  },
  {
    id: 'receipts', views: ['receipts'],
    title: { he: 'קבלות ו-Invoices', yi: 'קבלות און Invoices', en: 'Receipts and invoices' },
    body: {
      he: `### להוציא קבלה
1. לחץ "Invoice & Receipt" בלובי.
2. בחר סוג: {{rcKindReceipt}} (שולם) · {{rcKindInvoice}} (עוד לא שולם) · {{rcKindYear}} (כל נדבות השנה, למס) · {{rcKindCampaign}}.
3. בחר מוסד ותאריכים, ובחר בשביל מי — אדם אחד או רשימה.
4. סמן את השורות ולחץ "🖨 הדפסה / PDF".
- כל קבלה מקבלת מספר (סדרה אחת מ-1001; חשבוניות INV-1001). הדפסה שנייה של אותה קבלה יוצאת עם אותו מספר, כעותק.
- קבלה לנדבה אחת: פתח את הנדבה ולחץ "🧾 קבלה".
### לשנות פרטים בקבלה — הכפתור 🧾 בשורה
- בחר תרומה או מכירה (במכירה — סמן אם יש Sales Tax).
- כמה תרומות בקבלה אחת — הוסף אותן באותו טופס.
- קיבל משהו תמורת התרומה (למשל ארוחת דינר)? כתוב מה וכמה שווה — הקבלה תראה כמה מוכר למס.
- בחר חתימה: של המוסד, שלך, זמנית או בלי.
### לשלוח קבלה במייל
1. סמן את השורות ולחץ ✉. התורם מקבל מכתב עם הקבלה כ-PDF.
2. מי שאין לו מייל מדולג. הוסף מייל בכרטיס שלו, ולחץ ✉ ליד הקבלה ברשימה למטה.
### מכתב עם קבלה בתוכו
1. ב-Mail Merge, במכתב, לחץ הוספה ← "ייבוא קבלה".
2. הדפס ממסך הקבלות עם המכתב הזה — הקבלה נכנסת לשליש התחתון של כל מכתב.
- קבלה לבד מתאימה למעטפת חלון #10 (הכתובת נדפסת למטה).
### קבלה שיצאה בטעות
- מצא אותה למטה ברשימת הקבלות שהונפקו ולחץ ביטול. הבקשה נשלחת למנהל.`,
      yi: `### ארויסגעבן א קבלה
1. דריקט "Invoice & Receipt" אין לאבי.
2. קלייבט דעם סארט: {{rcKindReceipt}} (באצאלט) · {{rcKindInvoice}} (נאך נישט באצאלט) · {{rcKindYear}} (אלע נדבות פונעם יאר, פאר טעקס) · {{rcKindCampaign}}.
3. קלייבט דעם מוסד און די דאטעס, און פאר וועמען — איין מענטש אדער א רשימה.
4. צייכנט די שורות און דריקט "🖨 דרוקן / PDF".
- יעדע קבלה באקומט א נומער (איין סעריע פון 1001; Invoices INV-1001). דרוקט מען די זעלבע קבלה נאכאמאל — קומט ארויס דער זעלבער נומער, ווי א קאפיע.
- א קבלה פאר איין נדבה: עפנט די נדבה און דריקט "🧾 קבלה".
### טוישן פרטים אין א קבלה — דער קנעפל 🧾 אין דער שורה
- קלייבט נדבה אדער פארקויף (ביים פארקויף — צייכנט צי ס'איז דא Sales Tax).
- עטליכע נדבות אין איין קבלה — לייגט זיי צו אינעם זעלבן פארם.
- האט ער באקומען עפעס פאר דער נדבה (למשל א דינער סעודה)? שרייבט וואס און וויפיל עס איז ווערט — די קבלה ווייזט וויפיל איז דיקטאקטעבל.
- קלייבט א חתימה: פונעם מוסד, אייערע, א צייטווייליגע אדער אן.
### שיקן א קבלה אין אימעיל
1. צייכנט די שורות און דריקט ✉. דער נדבן באקומט א בריוו מיט דער קבלה ווי PDF.
2. ווער עס האט נישט קיין אימעיל ווערט איבערגעשפרונגען. לייגט צו אן אימעיל אינעם כרטיס, און דריקט ✉ ביי דער קבלה אין דער רשימה אונטן.
### א בריוו מיט א קבלה אינעווייניג
1. אין Mail Merge, אינעם בריוו, דריקט הוספה ← "ייבוא קבלה".
2. דרוקט פונעם קבלות-בלאט מיט דעם בריוו — די קבלה קומט אריין אינעם אונטערשטן דריטל פון יעדן בריוו.
- א קבלה אליין פאסט פאר א #10 קאנווערט מיט א פענצטער (דער אדרעס ווערט געדרוקט אונטן).
### א קבלה וואס איז ארויס בטעות
- טרעפט זי אונטן ביי די קבלות וואס זענען שוין ארויס און דריקט בטל. די בקשה גייט צום מנהל.`,
      en: `### Issue a receipt
1. Press "Invoice & Receipt" in the lobby.
2. Pick the kind: {{rcKindReceipt}} (paid) · {{rcKindInvoice}} (not yet paid) · {{rcKindYear}} (all of a year's donations, for taxes) · {{rcKindCampaign}}.
3. Pick the institution and dates, and who it's for — one person or a list.
4. Check the rows and press "🖨 Print / PDF".
- Each receipt gets a number (one series from 1001; invoices INV-1001). Printing the same receipt again gives the same number, as a copy.
- A receipt for one donation: open the donation and press "🧾 Receipt".
### Change receipt details — the 🧾 button on the row
- Pick donation or sale (for a sale — mark whether there's Sales Tax).
- Several donations on one receipt — add them in the same form.
- Did he get something for the donation (e.g. a dinner)? Type what and how much it's worth — the receipt shows the deductible amount.
- Pick a signature: the institution's, yours, temporary or none.
### Email a receipt
1. Check the rows and press ✉. The donor gets a letter with the receipt as a PDF.
2. Anyone without an email is skipped. Add the email on his card, then press ✉ next to the receipt in the list below.
### A letter with a receipt inside
1. In Mail Merge, in the letter, press Insert → "Import receipt".
2. Print from the receipts page with that letter — the receipt goes into the bottom third of each letter.
- A receipt alone fits a #10 window envelope (the address prints at the bottom).
### A receipt issued by mistake
- Find it below in the list of issued receipts and press void. The request goes to an admin.`,
    },
  },
  {
    id: 'campaigns', views: ['donhub', 'campaign'],
    title: { he: 'קמפיינים', yi: 'קאמפיינען', en: 'Campaigns' },
    body: {
      he: `1. לחץ {{lobbyDonations}} בלובי. למעלה — הקמפיינים, למטה — הנדבות האחרונות.
2. לחץ על קמפיין — תראה כמה נכנס מול היעד, ומי נתן.
3. קמפיין שנתי (דינר, קווה…): לחץ {{allYearsLink}} כדי לראות את השנה מול שנה שעברה.
4. לחץ {{lapsedTitle}} — מי שנתן שנה שעברה ועוד לא השנה. משם אפשר להדפיס, להוריד ל-Excel, או להכניס נדבה ישר לשורה.`,
      yi: `1. דריקט {{lobbyDonations}} אין לאבי. אויבן — די קאמפיינען, אונטן — די לעצטע נדבות.
2. קליקט אויף א קאמפיין — איר זעט וויפיל איז אריין קעגן דעם ציל, און ווער האט געגעבן.
3. א יערליכע קאמפיין (דינער, קאווע…): דריקט {{allYearsLink}} צו זען דאס יאר קעגן פאריגן יאר.
4. דריקט {{lapsedTitle}} — ווער האט געגעבן פאריגס יאר און נאך נישט היי-יאר. פון דארט קען מען דרוקן, אראפנעמען אין Excel, אדער אריינלייגן א נדבה גלייך אין דער שורה.`,
      en: `1. Press {{lobbyDonations}} in the lobby. Campaigns on top, recent donations below.
2. Click a campaign — see how much came in against the goal, and who gave.
3. A yearly campaign (dinner, Kave…): press {{allYearsLink}} to see this year against last year.
4. Press {{lapsedTitle}} — who gave last year and not yet this year. From there you can print, download to Excel, or enter a donation right on the row.`,
    },
  },
  {
    id: 'lists', views: ['lists'],
    title: { he: 'רשימות', yi: 'רשימות', en: 'Lists' },
    body: {
      he: `לחץ "רשימות" בלובי. יש רשימות מוכנות (עם כתובת, חייבים, יארצייטים השבוע, נשים, עם מייל, חסר שם באנגלית או כתובת) ורשימות שמורות.
### לבנות רשימה חדשה
1. לחץ {{newList}}.
2. בחר כללים: מוסד, תגיות (ואילו מצבים — פעיל / יוצא), אזור, נדבות.
3. בחר אילו עמודות להציג.
4. צריך להוסיף או להוריד מישהו ביד? עשה זאת ברשימה עצמה.
- רשימה חדשה רואה רק אתה. כדי שכולם יראו — לחץ {{lbPublish}}.
- להוריד למחשב — לחץ Excel.
### לשלוח מייל לרשימה
1. לחץ ✉ ליד הרשימה.
2. בחר {{mailOrg}} (איזה מוסד), כתוב נושא ותוכן. כתוב {name} במקום השם — כל אחד יקבל את שמו.
3. צרף תמונות או קבצים אם צריך.
4. לחץ {{mailTest}} ובדוק את המייל שקיבלת.
5. שלח. (ג'ימייל מרשה בערך 500 מיילים ביום.)`,
      yi: `דריקט "רשימות" אין לאבי. ס'זענען דא גרייטע רשימות (מיט אן אדרעס, שולדיג, יארצייטן די וואך, נשים, מיט אן אימעיל, פעלט ענגליש נאמען אדער אדרעס) און אפגעהיטענע רשימות.
### מאכן א נייע רשימה
1. דריקט {{newList}}.
2. קלייבט כללים: מוסד, טעג'ס (און וועלכע מצבים — פעיל / יוצא), געגנט, נדבות.
3. קלייבט וועלכע קאלומען צו ווייזן.
4. מ'דארף צולייגן אדער אראפנעמען איינעם מיט דער האנט? טוט עס אין דער רשימה אליין.
- א נייע רשימה זעט נאר איר. אז אלע זאלן זען — דריקט {{lbPublish}}.
- אראפנעמען אויפן קאמפיוטער — דריקט Excel.
### שיקן אן אימעיל צו א רשימה
1. דריקט ✉ ביי דער רשימה.
2. קלייבט {{mailOrg}} (וועלכער מוסד), שרייבט א נושא און דעם טעקסט. שרייבט {name} אנשטאט דעם נאמען — יעדער באקומט זיין נאמען.
3. לייגט צו בילדער אדער טעקעס אויב מ'דארף.
4. דריקט {{mailTest}} און קוקט אויפן אימעיל וואס איר האט באקומען.
5. שיקט. (Gmail לאזט בערך 500 אימעילס א טאג.)`,
      en: `Press "Lists" in the lobby. There are ready lists (with an address, owing, yahrzeits this week, women, with an email, missing English name or address) and saved lists.
### Build a new list
1. Press {{newList}}.
2. Pick rules: institution, tags (and which statuses — active / left), area, donations.
3. Pick which columns to show.
4. Need to add or remove someone by hand? Do it in the list itself.
- A new list is visible only to you. For everyone to see it — press {{lbPublish}}.
- To download — press Excel.
### Email a list
1. Press ✉ next to the list.
2. Pick {{mailOrg}} (which institution), type a subject and the text. Type {name} in place of the name — everyone gets their own name.
3. Attach pictures or files if needed.
4. Press {{mailTest}} and check the email you got.
5. Send. (Gmail allows about 500 emails a day.)`,
    },
  },
  {
    id: 'mailmerge', views: ['mailmerge'],
    title: { he: 'מכתבים ו-Mail Merge', yi: 'בריוו און Mail Merge', en: 'Letters and Mail Merge' },
    body: {
      he: `לחץ "Mail Merge" בלובי. יש שלוש עמודות: ✉ מעטפות · 🏷 מדבקות · 📄 מכתבים. כל מה שתעשה נשמר לבד.
### להדפיס לרשימה
1. לחץ "+ חדש", או פתח עיצוב שמור.
2. בחר נמענים: רשימה, אדם אחד, או הדבקה. אפשר לבחור "לאישה" וסדר (שם / מיקוד / אזור).
3. עצב: גרור דברים בעכבר, והכנס שדות כמו «שם» — הם מתמלאים לכל אחד.
4. בדוק את פס הבעיות (ירוק / צהוב / אדום): בלי כתובת, נפטר, בלי שם באנגלית, כתובת כפולה. לחץ על בעיה כדי לראות רק אותם, ו"דלג" כדי להוציא מישהו.
5. הדפס קודם {{mxTestOne}}.
6. לחץ 🖨 הדפסה או PDF — הכל, או מ–עד.
### מעטפות
- בחר גודל מעטפה, שפת הנמען (אנגלית / עברית / שתיהן) וכתובת חזרה עם לוגו.
- מעטפת חלון: בחר #10 Window, הדפס ניסיון ובדוק שהכתובת נופלת בחלון.
### מדבקות
- בחר את סוג הגיליון (Avery 5160–5167 או גיליון שלך).
- הגיליון כבר התחיל? כתוב כמה מדבקות כבר נוצלו.
- המדבקות לא יושבות טוב? הדפס {{mxTestSheet}} ותקן בהזזה.
### מכתבים
- כתוב ישר על העמוד, כמו ב-Word. בסרגל למעלה: גופן וצבעים, הוספת טבלה / תמונה / חתימה / קבלה, גודל דף, ושדות מיזוג.
- לראות איך ייראה אצל כל נמען — לחץ ◀ ▶.
- שמור: Ctrl+S. עיצוב חדש ממנו: F12 (שמור בשם).
- מכתב ומעטפה יחד: בחר "זוג" — יצאו שני PDF באותו סדר.
- אפשר גם לשלוח את המכתבים במייל. מי שאין לו מייל — יודפס.`,
      yi: `דריקט "Mail Merge" אין לאבי. ס'זענען דא דריי קאלומען: ✉ קאנווערטן · 🏷 לעיבלס · 📄 בריוו. אלעס וואס איר טוט ווערט אליין אפגעהיטן.
### דרוקן פאר א רשימה
1. דריקט "+ נייער", אדער עפנט אן אפגעהיטענע דיזיין.
2. קלייבט ווער עס באקומט: א רשימה, איין מענטש, אדער אריינקלעבן. מ'קען קלייבן "צו דער פרוי" און די סדר (נאמען / זיפ / געגנט).
3. דיזיינט: שלעפט זאכן מיטן מויז, און לייגט אריין פעלדער ווי «נאמען» — זיי פילן זיך אויס פאר יעדן.
4. קוקט דעם פראבלעם-שטרייף (גרין / געל / רויט): אן אדרעס, נפטר, אן ענגליש נאמען, דער זעלבער אדרעס צוויי מאל. קליקט אויף א פראבלעם צו זען נאר זיי, און "איבערשפרינגען" ארויסצונעמען איינעם.
5. דרוקט קודם {{mxTestOne}}.
6. דריקט 🖨 דרוקן אדער PDF — אלעס, אדער פון–ביז.
### קאנווערטן
- קלייבט די גרייס, די שפראך פונעם אדרעס (ענגליש / העברעאיש / ביידע) און א צוריק-אדרעס מיט א לאגא.
- א קאנווערט מיט א פענצטער: קלייבט #10 Window, דרוקט א פראבע און קוקט אז דער אדרעס פאלט אינעם פענצטער.
### לעיבלס
- קלייבט דעם סארט בויגן (Avery 5160–5167 אדער אייער אייגענער).
- דער בויגן איז שוין אנגעהויבן? שרייבט וויפיל לעיבלס זענען שוין גענוצט.
- די לעיבלס זיצן נישט גוט? דרוקט {{mxTestSheet}} און פאררעכט מיט רוקן.
### בריוו
- שרייבט גלייך אויפן בלאט, ווי אין Word. אינעם שטרייף אויבן: שריפט און קאלירן, צולייגן א טאבעלע / בילד / חתימה / קבלה, בלאט גרייס, און פעלדער.
- צו זען ווי עס וועט אויסזען ביי יעדן — דריקט ◀ ▶.
- אפהיטן: Ctrl+S. א נייע דיזיין דערפון: F12 (אפהיטן אלס).
- א בריוו מיט א קאנווערט צוזאמען: קלייבט "פּאָר" — עס קומען ארויס צוויי PDF אין דער זעלבער סדר.
- מ'קען אויך שיקן די בריוו אין אימעיל. ווער עס האט נישט קיין אימעיל — ווערט געדרוקט.`,
      en: `Press "Mail Merge" in the lobby. There are three columns: ✉ Envelopes · 🏷 Labels · 📄 Letters. Everything you do is saved by itself.
### Print for a list
1. Press "+ New", or open a saved design.
2. Pick recipients: a list, one person, or paste. You can pick "to the wife" and the order (name / ZIP / area).
3. Design: drag things with the mouse and insert fields like «Name» — they fill in for each person.
4. Check the problems bar (green / yellow / red): no address, deceased, no English name, the same address twice. Click a problem to see only those, and "Skip" to leave someone out.
5. First print {{mxTestOne}}.
6. Press 🖨 Print or PDF — everything, or from–to.
### Envelopes
- Pick the envelope size, the recipient's language (English / Hebrew / both) and a return address with a logo.
- A window envelope: pick #10 Window, print a test and check the address falls in the window.
### Labels
- Pick the sheet type (Avery 5160–5167 or your own).
- The sheet is already partly used? Type how many labels are used up.
- Labels don't sit right? Print {{mxTestSheet}} and fix it with nudge.
### Letters
- Type right on the page, like in Word. The ribbon on top: font and colors, insert a table / picture / signature / receipt, page size, and merge fields.
- To see how it looks for each recipient — press ◀ ▶.
- Save: Ctrl+S. A new design from it: F12 (Save As).
- A letter with an envelope: pick "Pair" — you get two PDFs in the same order.
- Letters can also go out by email. Anyone without an email gets a printed one.`,
    },
  },
  {
    id: 'occasions', views: ['occasions', 'simchos'],
    title: { he: 'יארצייטים ומאורעות', yi: 'יארצייטן און מאורעות', en: 'Yahrzeits and occasions' },
    body: {
      he: `### לראות מה מתקרב
- לחץ {{lobbyOccasions}} בלובי — יארצייטים ושמחות בימים הקרובים.
- רשימה להדפסה: רשימות ← "יארצייטים השבוע".
### להוסיף יארצייט או מאורע
1. לחץ {{newOccasion}} (או בכרטיס ← משפחה).
2. בחר סוג (יארצייט, יום הולדת…), את האדם ואת התאריך העברי.
3. לחץ {{save}}. מעכשיו הוא יופיע כל שנה בלוח.
### {{lobbySimchos}} (מזל טובים לגליון)
1. לחץ {{lobbySimchos}} בלובי. החלף שבוע עם ‹ ›.
2. לחץ "+ {{sgNew}}": בחר סוג, בחר את בעלי השמחה מהמאגר, ובחר את הקשר שלהם לילד (אב / סב / סב רבה).
3. בדוק משמאל איך העמוד נראה, ולחץ 🖨 הדפסה או ⬇ PDF.`,
      yi: `### זען וואס קומט
- דריקט {{lobbyOccasions}} אין לאבי — יארצייטן און שמחות די קומענדיגע טעג.
- א רשימה צו דרוקן: רשימות ← "יארצייטן די וואך".
### צולייגן א יארצייט אדער א מאורע
1. דריקט {{newOccasion}} (אדער אינעם כרטיס ← משפחה).
2. קלייבט דעם סארט (יארצייט, געבורטסטאג…), דעם מענטש און דעם אידישן דאטום.
3. דריקט {{save}}. פון יעצט וועט עס זיך ווייזן יעדעס יאר אינעם לוח.
### {{lobbySimchos}} (מזל טובס פארן גליון)
1. דריקט {{lobbySimchos}} אין לאבי. טוישט די וואך מיט ‹ ›.
2. דריקט "+ {{sgNew}}": קלייבט דעם סארט, די בעלי שמחה פונעם מאגר, און זייער קשר צום קינד (טאטע / זיידע / עלטער-זיידע).
3. קוקט אויף לינקס ווי דער בלאט זעט אויס, און דריקט 🖨 דרוקן אדער ⬇ PDF.`,
      en: `### See what's coming
- Press {{lobbyOccasions}} in the lobby — yahrzeits and simchas in the coming days.
- A list to print: Lists → "Yahrzeits this week".
### Add a yahrzeit or occasion
1. Press {{newOccasion}} (or on the card → family).
2. Pick the kind (yahrzeit, birthday…), the person and the Hebrew date.
3. Press {{save}}. From now on it shows every year on the board.
### {{lobbySimchos}} (mazel tovs for the gilyon)
1. Press {{lobbySimchos}} in the lobby. Change the week with ‹ ›.
2. Press "+ {{sgNew}}": pick the kind, the baalei simcha from the database, and their relation to the child (father / grandfather / great-grandfather).
3. Check on the left how the page looks, and press 🖨 Print or ⬇ PDF.`,
    },
  },
  {
    id: 'calls', views: ['calls'],
    title: { he: 'שיחות ו-SMS', yi: 'רופן און SMS', en: 'Calls and SMS' },
    body: {
      he: `### לשלוח SMS או שיחה מוקלטת
1. לחץ "Calls & SMS" בלובי ← {{smsTabSend}}.
2. בחר SMS או הקלטה.
3. בחר רשימה וכתוב את הטקסט (או בחר הקלטה).
4. מתי לשלוח? השאר ריק = עכשיו.
5. בדוק כמה יקבלו וכמה זה עולה, ולחץ שלח.
### שים לב
- מקבלים רק מי שהסכימו (📱 בכרטיס). מופיע "⚠ ללא הסכמה"? סמן מאיפה ההסכמה (רשימה ישנה / בעל פה).
- בשבת, יום טוב, ערב שבת אחר הצהריים, ולפני 8:00 או אחרי 21:00 — ההודעה מחכה לבד לזמן מותר.
- מי ששלח STOP לא יקבל יותר. מי ששלח JOIN נרשם לבד.
- נגמרו הקרדיטים? לחץ {{smsBuy}} (בכרטיס אשראי), או בקש ממנהל.
- תשובות מגיעות ל{{lobbyPersonal}} שלך.
### להקליט הודעה
- העלה קובץ MP3, או התקשר מהטלפון למספר ההקלטות ולחץ 2.
### לשלוח למערכת SMS מהטלפון שלך
- מהטלפון הרשום שלך כתוב פשוט: "להוסיף…", "מה הטלפון של…", "נדבה מ…", או שלח תמונה של הזמנה.
- המערכת תענה מה שהבינה. ענה 1 לאישור או 2 לביטול.`,
      yi: `### שיקן א SMS אדער אן אויפגענומענעם רוף
1. דריקט "Calls & SMS" אין לאבי ← {{smsTabSend}}.
2. קלייבט SMS אדער אן אויפנאמע.
3. קלייבט א רשימה און שרייבט דעם טעקסט (אדער קלייבט אן אויפנאמע).
4. ווען צו שיקן? לאזט ליידיג = יעצט.
5. קוקט וויפיל וועלן באקומען און וויפיל עס קאסט, און דריקט שיקן.
### געדענקט
- עס באקומען נאר די וואס האבן מסכים געווען (📱 אינעם כרטיס). שטייט "⚠ אן הסכמה"? צייכנט פון וואו די הסכמה (אלטע רשימה / מויל).
- שבת, יום טוב, ערב שבת נאכמיטאג, און פאר 8:00 אדער נאך 21:00 — די מעלדונג ווארט אליין ביז א מותר'דיגע צייט.
- ווער עס האט געשיקט STOP באקומט מער נישט. ווער עס האט געשיקט JOIN איז אליין איינגעשריבן.
- די קרעדיטן זענען אויס? דריקט {{smsBuy}} (מיט א קרעדיט קארד), אדער בעט א מנהל.
- ענטפערס קומען אין אייער {{lobbyPersonal}}.
### אויפנעמען א מעלדונג
- לייגט ארויף א MP3, אדער רופט פונעם טעלעפאן דעם אויפנאמע-נומער און דריקט 2.
### שיקן צום סיסטעם א SMS פון אייער טעלעפאן
- פון אייער רעגיסטרירטן טעלעפאן שרייבט פשוט: "צולייגן…", "וואס איז דער טעלעפאן פון…", "א נדבה פון…", אדער שיקט א בילד פון א הזמנה.
- דער סיסטעם ענטפערט וואס ער האט פארשטאנען. ענטפערט 1 צו באשטעטיגן אדער 2 צו בטל'ן.`,
      en: `### Send an SMS or a recorded call
1. Press "Calls & SMS" in the lobby → {{smsTabSend}}.
2. Pick SMS or recording.
3. Pick a list and type the text (or pick a recording).
4. When to send? Leave empty = now.
5. Check how many will get it and the cost, and press send.
### Note
- Only people who agreed get it (📱 on the card). Shows "⚠ without consent"? Mark where the consent came from (old list / verbal).
- On Shabbos, Yom Tov, Erev Shabbos afternoon, and before 8:00 or after 21:00 — the message waits by itself for an allowed time.
- Whoever sent STOP gets nothing more. Whoever sent JOIN signed himself up.
- Out of credits? Press {{smsBuy}} (by credit card), or ask an admin.
- Replies arrive in your {{lobbyPersonal}}.
### Record a message
- Upload an MP3, or call the recording number from your phone and press 2.
### Text the system from your phone
- From your registered phone just write: "add…", "what is the phone of…", "a donation from…", or send a photo of an invitation.
- The system answers what it understood. Reply 1 to confirm or 2 to cancel.`,
    },
  },
  {
    id: 'faces', views: ['faces'],
    title: { he: 'סריקה וזיהוי תמונות', yi: 'סקענען און דערקענען בילדער', en: 'Scanning and identifying photos' },
    body: {
      he: `כאן המחשב מוצא פנים בוידאו ובתמונות של אירוע, ואתה מאשר מי כל אחד. הקבצים עצמם לא עולים לאינטרנט.
### לפתוח אירוע
1. לחץ {{fcTitle}} בלובי ← {{fcNewEvent}}.
2. כתוב שם ותאריך.
3. בחר רמת זהירות: {{fcModeNormal}} — כל זיהוי צריך אישור שלך; {{fcModeFast}} — זיהוי "כמעט בטוח" מאושר לבד (🤖).
### לסרוק (לשונית "סריקה")
1. לחץ {{fcPick2}} ובחר את הקבצים (אפשר מאות בבת אחת).
2. רק קטע מהוידאו? כתוב מ–עד (למשל 1:20:00). ריק = כל הסרטון.
3. בחר מהירות: מהירה (המחשב נהיה כבד) או עדינה (איטית, אפשר לעבוד במקביל).
4. לחץ {{fcStart}}. אפשר לעבוד בחלון אחר — רק אל תסגור את הדף.
5. בסוף לחץ {{fcUpload}} — עכשיו כל הגבאים יכולים לזהות.
- הסריקה נעצרה? כל מה שנמצא שמור. בחר שוב את אותם קבצים ולחץ {{fcStart}}.
- לחץ על פנים כדי לראות את התמונות שלו. תמונה של מישהו אחר? לחץ {{fcSplit}}.
- תמונת HEIC לא נפתחת? המר אותה ל-JPG.
### לזהות (לשונית "זיהוי")
1. לכל פנים יש הצעה: ירוק = כמעט בטוח, צהוב = כמה אפשרויות. לחץ על השם הנכון, או חפש שם אחר.
2. עבור בעין על הירוקים והורד ✓ ממי שלא נכון.
3. לא במאגר? לחץ {{fcNewPerson}} — נשמר לאירוע הזה בלבד. כדי שייכנס למאגר הכללי — לחץ {{fcToGeneral}}.
4. לא בטוח? לחץ {{fcSkip}}. לא פנים אמיתיות? לחץ {{fcDelFace}}.
- בתצוגת "אחד אחד" תראה את כל התמונות של אותו אדם. תמונה שלא שלו — לחץ {{fcSplit}}.
- תמונה טובה לכרטיס? לחץ {{fcSetPhoto}}.
### הרשימה הסופית (לשונית "משתתפים")
- כאן רואים מי היה באירוע. אורחים של האירוע בלבד אפשר להעביר למאגר הכללי גם מאוחר יותר.`,
      yi: `דא געפינט דער קאמפיוטער פנים אין ווידעאס און בילדער פון אן אירוע, און איר באשטעטיגט ווער יעדער איז. די טעקעס אליין גייען נישט ארויף אויף אינטערנעט.
### עפענען אן אירוע
1. דריקט {{fcTitle}} אין לאבי ← {{fcNewEvent}}.
2. שרייבט א נאמען און א דאטום.
3. קלייבט ווי פארזיכטיג: {{fcModeNormal}} — יעדע דערקענונג דארף אייער באשטעטיגונג; {{fcModeFast}} — "כמעט זיכער" ווערט אליין באשטעטיגט (🤖).
### סקענען (לשונית "סקענען")
1. דריקט {{fcPick2}} און קלייבט די טעקעס (מ'קען הונדערטער אויף איינמאל).
2. נאר א שטיקל פונעם ווידעא? שרייבט פון–ביז (למשל 1:20:00). ליידיג = דער גאנצער ווידעא.
3. קלייבט די גיכקייט: גיך (דער קאמפיוטער ווערט שווער) אדער שטיל (פאמעלעך, מ'קען ארבעטן דערווייל).
4. דריקט {{fcStart}}. מ'קען ארבעטן אין אן אנדער פענצטער — נאר נישט צומאכן דעם בלאט.
5. צום סוף דריקט {{fcUpload}} — יעצט קענען אלע גבאים דערקענען.
- די סקענונג האט זיך אפגעשטעלט? אלעס וואס איז געפונען איז אפגעהיטן. קלייבט נאכאמאל די זעלבע טעקעס און דריקט {{fcStart}}.
- קליקט אויף א פנים צו זען זיינע בילדער. א בילד פון אן אנדערן? דריקט {{fcSplit}}.
- א HEIC בילד עפנט זיך נישט? מאכט עס איבער אויף JPG.
### דערקענען (לשונית "דערקענען")
1. ביי יעדן פנים איז דא א פארשלאג: גרין = כמעט זיכער, געל = עטליכע מעגליכקייטן. קליקט אויפן ריכטיגן נאמען, אדער זוכט אן אנדערן.
2. גייט דורך די גרינע מיט די אויגן און נעמט אראפ ✓ פון די וואס שטימען נישט.
3. נישט אין מאגר? דריקט {{fcNewPerson}} — ווערט אפגעהיטן נאר פאר דעם אירוע. אז ער זאל אריין אינעם אלגעמיינעם מאגר — דריקט {{fcToGeneral}}.
4. נישט זיכער? דריקט {{fcSkip}}. נישט קיין אמת'ע פנים? דריקט {{fcDelFace}}.
- ביים ווייזן "איינס-איינס" זעט איר אלע בילדער פון דעם זעלבן מענטש. א בילד וואס איז נישט זיינס — דריקט {{fcSplit}}.
- א גוטע בילד פארן כרטיס? דריקט {{fcSetPhoto}}.
### די לעצטע רשימה (לשונית "משתתפים")
- דא זעט מען ווער עס איז געווען ביים אירוע. געסט נאר פון דעם אירוע קען מען אריבערפירן אינעם אלגעמיינעם מאגר אויך שפעטער.`,
      en: `Here the computer finds faces in an event's videos and photos, and you confirm who each one is. The files themselves don't go up to the internet.
### Open an event
1. Press {{fcTitle}} in the lobby → {{fcNewEvent}}.
2. Type a name and date.
3. Pick how careful: {{fcModeNormal}} — every match needs your approval; {{fcModeFast}} — "almost sure" is approved by itself (🤖).
### Scan ("Scan" tab)
1. Press {{fcPick2}} and choose the files (hundreds at once is fine).
2. Only part of a video? Type from–to (e.g. 1:20:00). Empty = the whole video.
3. Pick a speed: fast (the computer gets heavy) or gentle (slow, you can keep working).
4. Press {{fcStart}}. You can work in another window — just don't close the page.
5. At the end press {{fcUpload}} — now all gabbaim can identify.
- The scan stopped? Everything found is saved. Choose the same files again and press {{fcStart}}.
- Click a face to see his photos. A photo of someone else? Press {{fcSplit}}.
- A HEIC photo won't open? Convert it to JPG.
### Identify ("Identify" tab)
1. Each face has a suggestion: green = almost sure, yellow = several options. Click the right name, or search for another.
2. Look over the greens and remove ✓ from any that are wrong.
3. Not in the database? Press {{fcNewPerson}} — saved for this event only. To add him to the general database — press {{fcToGeneral}}.
4. Not sure? Press {{fcSkip}}. Not a real face? Press {{fcDelFace}}.
- In "one by one" view you see all of that person's photos. A photo that isn't him — press {{fcSplit}}.
- A good photo for the card? Press {{fcSetPhoto}}.
### The final list ("Participants" tab)
- Here you see who was at the event. Event-only guests can be moved into the general database later too.`,
    },
  },
  {
    id: 'personal', views: ['personal'],
    title: { he: 'איזור אישי: הודעות ומשימות', yi: 'איזור אישי: מעסעדזשעס און משימות', en: 'Personal area: messages and tasks' },
    body: {
      he: `לחץ {{lobbyPersonal}} למעלה. מספר ליד הכפתור = הודעות או משימות חדשות.
### משימה
1. כתוב משימה חדשה, ובחר למי: לעצמך או לגבאי אחר.
2. רוצה תזכורת? לחץ ⏰.
3. סיימת? לחץ ✓.
- משימה על אדם מסוים — פתח את הכרטיס שלו ולחץ {{cardTaskBtn}}.
### הודעות
- כתוב הודעה לכולם, למנהלים או לאדם אחד. כאן מגיעות גם תשובות של SMS.
### מה עוד יש כאן
- {{rqMine}} — מה ביקשת מהמנהל ואם אושר.
- למטה: אנשי הקשר שהוספת או שינית, והנדבות שהכנסת.`,
      yi: `דריקט {{lobbyPersonal}} אויבן. א נומער ביים קנעפל = נייע מעסעדזשעס אדער משימות.
### א משימה
1. שרייבט א נייע משימה, און קלייבט פאר וועמען: פאר זיך אדער פאר אן אנדער גבאי.
2. ווילט א דערמאנונג? דריקט ⏰.
3. פארטיג? דריקט ✓.
- א משימה וועגן א געוויסן מענטש — עפנט זיין כרטיס און דריקט {{cardTaskBtn}}.
### מעסעדזשעס
- שרייבט א מעסעדזש צו אלע, צו די מנהלים אדער צו איין מענטש. דא קומען אויך ענטפערס פון SMS.
### וואס נאך איז דא
- {{rqMine}} — וואס איר האט געבעטן פונעם מנהל און צי עס איז באשטעטיגט.
- אונטן: די קאנטאקטן וואס איר האט צוגעלייגט אדער געטוישט, און די נדבות וואס איר האט אריינגעלייגט.`,
      en: `Press {{lobbyPersonal}} at the top. A number next to it = new messages or tasks.
### A task
1. Type a new task and pick who it's for: yourself or another gabbai.
2. Want a reminder? Press ⏰.
3. Done? Press ✓.
- A task about a specific person — open his card and press {{cardTaskBtn}}.
### Messages
- Write a message to everyone, to the admins or to one person. SMS replies arrive here too.
### What else is here
- {{rqMine}} — what you asked an admin for and whether it was approved.
- At the bottom: contacts you added or changed, and donations you entered.`,
    },
  },
  {
    id: 'requests', views: ['personal', 'contacts'],
    title: { he: 'פעולות שצריכות אישור מנהל', yi: 'זאכן וואס דארפן א באשטעטיגונג פון א מנהל', en: 'Actions that need admin approval' },
    body: {
      he: `יש כמה פעולות שגבאי לא מבצע לבד — הן נשלחות למנהל לאישור: תגית חדשה · מחיקת איש קשר · מחיקת נדבה · ביטול קבלה · מיזוג כרטיסים.
### מה לעשות
1. לחץ על הכפתור הרגיל (למשל {{cardDelete}}).
2. כתוב בקצרה למה — זה עוזר למנהל להחליט.
3. הבקשה נשלחת. כשהמנהל מאשר — זה מתבצע לבד, ואתה מקבל הודעה.
- לראות מה ביקשת ומה אושר: {{lobbyPersonal}} ← {{rqMine}}.`,
      yi: `עטליכע זאכן טוט א גבאי נישט אליין — זיי גייען צום מנהל צו באשטעטיגן: א נייע טעג · אויסמעקן א קאנטאקט · אויסמעקן א נדבה · בטל'ן א קבלה · מערדזשן כרטיסן.
### וואס צו טון
1. דריקט דעם געווענליכן קנעפל (למשל {{cardDelete}}).
2. שרייבט קורץ פארוואס — דאס העלפט דעם מנהל באשליסן.
3. די בקשה גייט אוועק. ווען דער מנהל באשטעטיגט — ווערט עס אליין געטון, און איר באקומט א מעלדונג.
- צו זען וואס איר האט געבעטן און וואס איז באשטעטיגט: {{lobbyPersonal}} ← {{rqMine}}.`,
      en: `A few actions a gabbai doesn't do alone — they go to an admin for approval: a new tag · deleting a contact · deleting a donation · voiding a receipt · merging cards.
### What to do
1. Press the usual button (e.g. {{cardDelete}}).
2. Write briefly why — it helps the admin decide.
3. The request is sent. When the admin approves — it happens by itself, and you get a message.
- To see what you asked for and what was approved: {{lobbyPersonal}} → {{rqMine}}.`,
    },
  },
];

/** וועלכע פרקים פאסן צו א מסך (דער ערשטער = דער הויפט) */
export const helpForView = (view) => HELP.filter((s) => s.views.includes(view));
