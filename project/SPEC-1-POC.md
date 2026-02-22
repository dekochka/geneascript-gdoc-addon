# Project: GDoc - Metric Book Transcriber Add-On

Goal is to implement Google Script to get Context of Metric Book and Image from GDoc and transcribe it by sending prompt to google ai developer API and insert response to GDoc under image
Also provide insructions for users to enable Add On in their Google Workspace.

## Tasks

### 1. Explore Requirements & Google Script Capabilitites

Create Design document based on requirements below and place to docs folder.
Ask extra questions to refine design and proceed to next task only when confirms with me that review is done and all follow up corrections are made and final approve is provided by me.

Gooigle Add On docs https://developers.google.com/workspace/add-ons/overview
https://script.google.com/home


### 2. Implement Google Script "Transcribe Image"

Implement script based on design document.
Ask to review by me & refine. 
Provide setup steps in chat for me to test & provide feedback & find bugs.
Fix bugs and request approval after I make final tetss and confirm all working before proceeding to next step

### 4. Create Mardown documents - Installaton instructions & User Guide

Create User Guide and Installation insruction document

## Requirements

User is working on Google Document with Images - scans of metric.
It creates Context section in GDoc, provides info in this Section, then inserts Few Images of Metric Books into the doc.
"Transcribe Image" Action should be available in Add-Ons menu. It accepts context from doc, use API Token for Google AI Dev API (uses gemini-3-flash-preview model) to transcribe image selected and insert reponse text under image.
User clicks on image and clicks "Transcribe Image" Action in Extensions Menu.
Script gets Context, forms Prompt and sends it to google api for transcription, 
handles errors properly, sets timeout to 1 min, gets response and inserts under selected image.

See some sample code to send to google api

// --- CONFIGURATION ---
const API_KEY = "..."; 
const MODEL_ID = "gemini-3-flash-preview"; 


function callGemini(rawText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`;
  const prompt = ...

  const payload = JSON.stringify({
    "contents": [{ "parts": [{ "text": prompt }] }]
  });

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": payload,
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    

### Prompt Sample

#### Role

You are an expert archivist and paleographer specializing in 19th and early 20th-century Galician (Austrian/Polish/Ukrainian) 
vital records. Your task is to extract and transcribe handwritten text from the attached image of a metric book 
(birth, marriage, or death register).

#### Context

{{Section extracted from Context Section of Google Doc in section above image
it contains ARCHIVE_REFERENCE,  DOCUMENT_DESCRIPTION, DATE_RANGE, VILLAGES, COMMON_SURNAMES,
}}

#### Input Template Description

Contains List of expected Table Coliumns in Image

Metric Book may contain mix of diffferent table formats for births, deaths, marriage records.
Most common table columns are


**Metrical Book Births Table Schema Definition**

* **Column 1: Рожденъ / Natus**  
  * **Alternative Column Name:** Born  
  * **Column Format:** String (Date/Text)  
  * **isStructured:** False  
  * **Sample Value:** 13a Septembr 1888\. Obst. Irene  
  * **Parent Column Name:** Мѣсяцъ / Mensis  
  * **Parent Column Alternative Name:** Month  
  * **Column Description:** Day/Month/Year of birth,   
  * **CrossColumnNumbers:** None   
* **Column 2: Крещенъ / Baptisatus**  
  * **Alternative Column Name:** Baptized  
  * **Column Format:** String (Date)  
  * **isStructured:** False  
  * **Sample Value:** 13a  
  * **Parent Column Name:** Мѣсяцъ / Mensis  
  * **Parent Column Alternative Name:** Month  
  * **Column Description:** Day of baptism.  
  * **CrossColumnNumbers:** None  
* **Column 3: Мѵропомазанъ / Confirmatus**  
  * **Alternative Column Name:** Confirmed  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** \[Empty\]  
  * **Parent Column Name:** Мѣсяцъ / Mensis  
  * **Parent Column Alternative Name:** Month  
  * **Column Description:** Day of confirmation (often left blank if done simultaneously or not recorded).  
  * **CrossColumnNumbers:** None  
* **Column 4: Нумеръ дома / Numerus domus**  
  * **Alternative Column Name:** House Number  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** 11 Tur.  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** The house number/location where the child was born.  
  * **CrossColumnNumbers:** None  
* **Column 5: Имя / Nomen (Child)**  
  * **Alternative Column Name:** Name (Child)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** Eudocia  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** The given baptismal name of the child.  
  * **CrossColumnNumbers:** None  
* **Column 6: Католич. / Cathol.**  
  * **Alternative Column Name:** Catholic  
  * **Column Format:** Boolean (Mark)  
  * **isStructured:** True  
  * **Sample Value:** /  
  * **Parent Column Name:** Вѣроиспов. / Religio  
  * **Parent Column Alternative Name:** Religion  
  * **Column Description:** Mark indicating the child is of the Catholic faith.  
  * **CrossColumnNumbers:** None  
* **Column 7: Или иное / Aut alia**  
  * **Alternative Column Name:** Or Other (Religion)  
  * **Column Format:** Boolean (Mark)  
  * **isStructured:** True  
  * **Sample Value:** .  
  * **Parent Column Name:** Вѣроиспов. / Religio  
  * **Parent Column Alternative Name:** Religion  
  * **Column Description:** Mark indicating a different religion.  
  * **CrossColumnNumbers:** None  
* **Column 8: Хлопецъ / Puer**  
  * **Alternative Column Name:** Boy  
  * **Column Format:** Boolean (Mark)  
  * **isStructured:** True  
  * **Sample Value:** .  
  * **Parent Column Name:** Полъ / Sexus  
  * **Parent Column Alternative Name:** Sex  
  * **Column Description:** Mark indicating the child is male.  
  * **CrossColumnNumbers:** None  
* **Column 9: Дѣвочка / Puella**  
  * **Alternative Column Name:** Girl  
  * **Column Format:** Boolean (Mark)  
  * **isStructured:** True  
  * **Sample Value:** /  
  * **Parent Column Name:** Полъ / Sexus  
  * **Parent Column Alternative Name:** Sex  
  * **Column Description:** Mark indicating the child is female.  
  * **CrossColumnNumbers:** None  
* **Column 10: Законнаго / Legitimi**  
  * **Alternative Column Name:** Legitimate  
  * **Column Format:** Boolean / String  
  * **isStructured:** True  
  * **Sample Value:** legitimi  
  * **Parent Column Name:** Ложа / Thori  
  * **Parent Column Alternative Name:** Bed (Marriage)  
  * **Column Description:** Indicates the child was born to a legitimate married couple (often written vertically).  
  * **CrossColumnNumbers:** None  
* **Column 11: Незаконнаго / Illegitimi**  
  * **Alternative Column Name:** Illegitimate  
  * **Column Format:** Boolean / String  
  * **isStructured:** True  
  * **Sample Value:** \[Empty\]  
  * **Parent Column Name:** Ложа / Thori  
  * **Parent Column Alternative Name:** Bed (Marriage)  
  * **Column Description:** Indicates the child was born out of wedlock.  
  * **CrossColumnNumbers:** None  
* **Column 12: Имя / Nomen (Parents)**  
  * **Alternative Column Name:** Name (Parents)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** Andreas Dumaniuk fil. Georgii et Parasceves...  
  * **Parent Column Name:** Родители / Parentes  
  * **Parent Column Alternative Name:** Parents  
  * **Column Description:** Full names, parentage (fil.), and sometimes origins of the child's father and mother.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Father Name, Father Surname, Fathers Parents, Mothers Name, Mothers Surname, Mothers Parents, Full Parents Info (raw value)  
* **Column 13: Состояніе / Conditio (Parents)**  
  * **Alternative Column Name:** Status / Condition  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** agricolae  
  * **Parent Column Name:** Родители / Parentes  
  * **Parent Column Alternative Name:** Parents  
  * **Column Description:** The social estate, class, or occupation of the parents (e.g., farmers/peasants).  
  * **CrossColumnNumbers:** None  
* **Column 14: Имя / Nomen (Godparents)**  
  * **Alternative Column Name:** Name (Godparents)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** \+Nicolaus Rawluk \+Ahaphia uxor Pauli Hulek  
  * **Parent Column Name:** Кумы / Patrini  
  * **Parent Column Alternative Name:** Godparents  
  * **Column Description:** Full names and sometimes relationships of the assigned godparents.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Godparent 1, Godparent 2  
* **Column 15: Состояніе / Conditio (Godparents)**  
  * **Alternative Column Name:** Status / Condition  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** agricolae  
  * **Parent Column Name:** Кумы / Patrini  
  * **Parent Column Alternative Name:** Godparents  
  * **Column Description:** The social estate, class, or occupation of the godparents.  
  * **CrossColumnNumbers:** None


**Metrical Book Deaths Table Schema Definition**

* **Column 1: Число поряд. / Numerus posit.**  
  * **Alternative Column Name:** Record Number  
  * **Column Format:** String (Integer)  
  * **isStructured:** True  
  * **Sample Value:** 1  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** Sequential entry number for the year.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 2: Смерти / Mortis**  
  * **Alternative Column Name:** Date of Death  
  * **Column Format:** String (Date)  
  * **isStructured:** False  
  * **Sample Value:** 5 Martii 1935  
  * **Parent Column Name:** Місяць, День / Mensis, Dies  
  * **Parent Column Alternative Name:** Month, Day  
  * **Column Description:** Day, month, and year the death occurred.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Day, Month, Year, Raw Value  
* **Column 3: Похорону / Sepult.**  
  * **Alternative Column Name:** Date of Burial  
  * **Column Format:** String (Date)  
  * **isStructured:** False  
  * **Sample Value:** 7  
  * **Parent Column Name:** Місяць, День / Mensis, Dies  
  * **Parent Column Alternative Name:** Month, Day  
  * **Column Description:** Day of the burial.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Day, Month, Year, Raw Value  
* **Column 4: Число дому / Numerus domus**  
  * **Alternative Column Name:** House Number  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** 34  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** The house number where the deceased lived or died.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 5: Імя і назва помершого / Nomen et cognomen mortui**  
  * **Alternative Column Name:** Name of Deceased  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** Nicolaus Hurman, maritus Sophiae natae Pidskalnyj  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** Full name, surname, social status/occupation. For children, lists parentage; for married/widowed, lists spouse.  
  * **CrossColumnNumbers:** Typically spans standard columns for Priest's signature across the bottom.  
  * **ValueStructure:** Given Name, Surname, Occupation, Parent Names (if child), Spouse Name (if married/widowed), Raw Value  
* **Column 6: Католицьке / Religio catholica**  
  * **Alternative Column Name:** Catholic  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** 1  
  * **Parent Column Name:** Віроісп. / Religio  
  * **Parent Column Alternative Name:** Religion  
  * **Column Description:** Mark indicating if the deceased was Catholic.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 7: Мужеский / Masculinus**  
  * **Alternative Column Name:** Male  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** 1  
  * **Parent Column Name:** Пол / Sexus  
  * **Parent Column Alternative Name:** Sex  
  * **Column Description:** Mark indicating the deceased was male.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 8: Женський / Femininus**  
  * **Alternative Column Name:** Female  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** ‡  
  * **Parent Column Name:** Пол / Sexus  
  * **Parent Column Alternative Name:** Sex  
  * **Column Description:** Mark indicating the deceased was female.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 9: Літа житя / Anno vitae**  
  * **Alternative Column Name:** Age  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** 47 ann.  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** Age of the deceased at the time of death.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Age Number, Age Unit (years/months/days), Raw Value  
* **Column 10: Слабість і рід смерти / Morbus et qualitas mortis**  
  * **Alternative Column Name:** Cause of Death  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** vitium dis...  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** Illness or cause of death. Often includes references to medical certificates or reviews.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Cause of Death, Medical Certificate Reference, Raw Value

Marriage Book Schema Definition

* **Column 1: Число поряд. / Numerus posit.**  
  * **Alternative Column Name:** Record Number  
  * **Column Format:** String (Integer)  
  * **isStructured:** True  
  * **Sample Value:** 4  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** Sequential entry number for the year.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 2: Місяць — Mensis**  
  * **Alternative Column Name:** Date of Marriage  
  * **Column Format:** String (Date)  
  * **isStructured:** False  
  * **Sample Value:** 18/11 1933  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** The exact day, month, and year the marriage took place.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Day, Month, Year, Raw Value  
* **Column 3: Число дому / Numerus domus**  
  * **Alternative Column Name:** House Number  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** 29 / 17  
  * **Parent Column Name:** None  
  * **Parent Column Alternative Name:** None  
  * **Column Description:** House number of the groom and/or bride.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Groom House Number, Bride House Number, Raw Value  
* **Column 4: Імя / Nomen (Groom)**  
  * **Alternative Column Name:** Name (Groom)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** Cyrillus Mychalczuk fil. Pantaleonis...  
  * **Parent Column Name:** Наречений — Sponsus  
  * **Parent Column Alternative Name:** Groom  
  * **Column Description:** Full name, parentage, occupation, and origin of the groom.  
  * **CrossColumnNumbers:** Typically spans standard columns (e.g., 4-17) for Priest's notes/signature across the bottom.  
  * **ValueStructure:** Groom Given Name, Groom Surname, Groom Father Name, Groom Mother Name, Groom Mother Maiden Name, Groom Occupation, Groom Birthplace, Groom Residence, Raw Value  
* **Column 5: Католицьке / Catholica (Groom)**  
  * **Alternative Column Name:** Catholic (Groom)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** gr. cath.  
  * **Parent Column Name:** Віроісп. / Religio (Sponsus)  
  * **Parent Column Alternative Name:** Religion (Groom)  
  * **Column Description:** Indicates if the groom is Catholic.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 6: Або інше / Aut alia (Groom)**  
  * **Alternative Column Name:** Or Other (Groom)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** \[Empty\]  
  * **Parent Column Name:** Віроісп. / Religio (Sponsus)  
  * **Parent Column Alternative Name:** Religion (Groom)  
  * **Column Description:** Indicates if the groom belongs to another religion.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 7: Вік — Aetas (Groom)**  
  * **Alternative Column Name:** Age / DOB (Groom)  
  * **Column Format:** String (Date)  
  * **isStructured:** False  
  * **Sample Value:** 13/IV 1911  
  * **Parent Column Name:** Наречений — Sponsus  
  * **Parent Column Alternative Name:** Groom  
  * **Column Description:** Age or exact date of birth of the groom.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Birth Date, Age Years, Raw Value  
* **Column 8: Вільний — Coelebs (Groom)**  
  * **Alternative Column Name:** Single (Groom)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** coelebs  
  * **Parent Column Name:** Наречений — Sponsus  
  * **Parent Column Alternative Name:** Groom  
  * **Column Description:** Indicates if the groom was previously unmarried.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 9: Вдівець — Viduus (Groom)**  
  * **Alternative Column Name:** Widower (Groom)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** \[Empty\]  
  * **Parent Column Name:** Наречений — Sponsus  
  * **Parent Column Alternative Name:** Groom  
  * **Column Description:** Indicates if the groom is a widower.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 10: Імя / Nomen (Bride)**  
  * **Alternative Column Name:** Name (Bride)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** Anna Caruk, filia Joachimi...  
  * **Parent Column Name:** Наречена — Sponsa  
  * **Parent Column Alternative Name:** Bride  
  * **Column Description:** Full name, parentage, occupation, and origin of the bride.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Bride Given Name, Bride Surname, Bride Father Name, Bride Mother Name, Bride Mother Maiden Name, Bride Occupation, Bride Birthplace, Bride Residence, Raw Value  
* **Column 11: Католицьке / Catholica (Bride)**  
  * **Alternative Column Name:** Catholic (Bride)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** gr. cath.  
  * **Parent Column Name:** Віроісп. / Religio (Sponsa)  
  * **Parent Column Alternative Name:** Religion (Bride)  
  * **Column Description:** Indicates if the bride is Catholic.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 12: Або інше / Aut alia (Bride)**  
  * **Alternative Column Name:** Or Other (Bride)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** \[Empty\]  
  * **Parent Column Name:** Віроісп. / Religio (Sponsa)  
  * **Parent Column Alternative Name:** Religion (Bride)  
  * **Column Description:** Indicates if the bride belongs to another religion.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 13: Вік — Aetas (Bride)**  
  * **Alternative Column Name:** Age / DOB (Bride)  
  * **Column Format:** String (Date)  
  * **isStructured:** False  
  * **Sample Value:** 20/X 1913  
  * **Parent Column Name:** Наречена — Sponsa  
  * **Parent Column Alternative Name:** Bride  
  * **Column Description:** Age or exact date of birth of the bride.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Birth Date, Age Years, Raw Value  
* **Column 14: Вільна — Coelebs (Bride)**  
  * **Alternative Column Name:** Single (Bride)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** coelebs  
  * **Parent Column Name:** Наречена — Sponsa  
  * **Parent Column Alternative Name:** Bride  
  * **Column Description:** Indicates if the bride was previously unmarried.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 15: Вдова — Vidua (Bride)**  
  * **Alternative Column Name:** Widow (Bride)  
  * **Column Format:** String / Boolean  
  * **isStructured:** True  
  * **Sample Value:** \[Empty\]  
  * **Parent Column Name:** Наречена — Sponsa  
  * **Parent Column Alternative Name:** Bride  
  * **Column Description:** Indicates if the bride is a widow.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** None  
* **Column 16: Імя / Nomen (Witnesses)**  
  * **Alternative Column Name:** Name (Witnesses)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** Alexius Muzyka

     Basilius Hutasewycz  
  * **Parent Column Name:** Свідки / Testes  
  * **Parent Column Alternative Name:** Witnesses  
  * **Column Description:** Names of the official marriage witnesses.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Witness 1 Full Name, Witness 2 Full Name, Raw Value  
* **Column 17: Стан / Conditio (Witnesses)**  
  * **Alternative Column Name:** Status (Witnesses)  
  * **Column Format:** String  
  * **isStructured:** False  
  * **Sample Value:** agricolae in Turylcze  
  * **Parent Column Name:** Свідки / Testes  
  * **Parent Column Alternative Name:** Witnesses  
  * **Column Description:** Social estate, class, or occupation of the witnesses.  
  * **CrossColumnNumbers:** None  
  * **ValueStructure:** Witness 1 Status, Witness 2 Status, Raw Value


#### Output Format

Output includes Header-level info, Record-level info, 

Page Header Format

Extract any metadata from the top of the page, including:
Year of the record.
Page number (Pagina).
Archival signatures (Fond/Opis/Case if visible - look for "Fond {{FOND_NUMBER}}").
Village names listed in the header.

Record Output Format

For each record, generate a summary in 
original transcription in Latin 
Russian 
Ukrainian 

For russian and ukraininan use the most appropriate modern Western Ukrainian surname equivalent. 
The address should always be the first line.
Then name of person (births or deaths), groom and bride on every new line.
Include info on fathers mothers (and its fathers and mothers if available on separate line)
Also include info on godfather and godmothers and on separate line.
Include additional info extracted on separate line in notes section.
Only transcribed text.

Also include handwriting quality metrics, trust metric and section for user to provide assessment of output in format:
Quality Metrics:
- Handwriting Quality: e.g. 3/5 with 5 the highest score 
- Trust Score: 4/5, with 5 the highest score, it shows how confident are you that transxcribed text corresponds to image
Assessment: 
- Quality of Output: e.g. 2/5 (User-provided score after verification of output, )
- Corrections Notes: notes by user on what is incorrect in transcribed text 

See below examples of of desired output for every record.

Birth Record Example for transcription output:

{{MAIN_VILLAGE_NAME}}, дом 24
Николай Чепесюк (род. 18/03/1894)
Родители: Гавриил Чепесюк (сын Максимилиана Чепесюка и Анны Чомулы) и Мария 
  (дочь Ивана Павлюка и Ирины Романюк).
Кумы: Терентий Павлюк и Мария, жена Николая Павлюка.
Заметка: Крестил священник Иосиф Балко. Повитуха Параскева Демкив.

{{MAIN_VILLAGE_NAME}}, будинок 24
Микола Чепесюк (нар. 18/03/1894)
Батьки: Гаврило Чепесюк (син Максиміліана Чепесюка та Анни Чомули) та Марія 
  (дочка Івана Павлюка та Ірини Романюк).
Куми: Терентій Павлюк та Марія, дружина Миколи Павлюка.
Замітка: Хрестив священик Йосип Балко. Баба-повитуха Параскева Демків.

{{MAIN_VILLAGE_NAME_LATIN}}, domus 24
18 18 Martii 1894 | domus 24 | Nicolaus | Catholicus | Puer | Legitimi |
Parentes: Gabriel filius Maximiliani Czepesiuk et Annae Ciomula; 
  Maria filia Joannis Pawluk et Irenae Romanjuk. agricolae.
Patrini: Terentius Pawluk et Maria uxor Nicolai Pawluk. agricolae.
Notes: Obstetrix non approbata Parasceva Demkiw. 
  Baptisavit confirmavitque Josephus Balko parochus.

{{MAIN_VILLAGE_NAME_LATIN}}, House 24
Nicolaus Chepesiuk (born 18/03/1894)
Parents: Gabriel Chepesiuk (son of Maximilian Chepesiuk and Anna Ciomula) and Maria 
  (daughter of John Pavliuk and Irene Romaniuk).
Godparents: Terentius Pavliuk and Maria, wife of Nicholas Pavliuk.
Notes: Midwife Parasceva Demkiw. Baptized by priest Joseph Balko.

Marriage Record Example  for transcription output:

{{MAIN_VILLAGE_NAME}}, дом 4
Брак 28/07/1837
Жених: Павел Федорович Гулик (род 10/11/1843), {{MAIN_VILLAGE_NAME}}, дом 4.
Невеста: Анна Алексеевна Гулик (род 12/09/1842), {{MAIN_VILLAGE_NAME}}, дом 70.
Родители жениха: Федор Гулик (сын Василия и Марии Гулик) и Пелагея (дочь Петра Федоришина и Ирины Шевчук).
Родители невесты: Алексей Гулик (сын Павла и Ольги Лазарюк) и Софья (дочь Василия Софроник и Марии Кулик).
Свидетели: Василь Шевчук и Ольга, жена Федора Микитюк, из {{MAIN_VILLAGE_NAME}}, дом 35.
Заметки: Кратко другие факты из записи.

{{MAIN_VILLAGE_NAME}}, будинок 4
Шлюб 28/07/1837
Наречений: Павло Федорович Гулик (нар. 10/11/1843), {{MAIN_VILLAGE_NAME}}, будинок 4.
Наречена: Анна Олексіївна Гулик (нар. 12/09/1842), {{MAIN_VILLAGE_NAME}}, будинок 70.
Батьки нареченого: Федір Гулик (син Василя та Марії Гулик) та Пелагея (дочка Петра Федоришина та Ірини Шевчук).
Батьки нареченої: Олексій Гулик (син Павла та Ольги Лазарюк) та Софія (дочка Василя Софроника та Марії Кулик).
Свідки: Василь Шевчук та Ольга, дружина Федора Микитюка, з {{MAIN_VILLAGE_NAME}}, будинок 35.
Заметки:(Стисло інші факти із запису).

{{MAIN_VILLAGE_NAME_LATIN}}, domus 63 / 45
3 | Martii 5 1932 | domus 63/45 | 
Isidorus Hulyk, filius Pauli et Eudoxiae Wasylczuk, laboriosus | aetas 21 | vidus | 
Maria Lesiw, filia Basilii et Catharinae Mykytyn, {{MAIN_VILLAGE_NAME_LATIN}}, domus 45 | agricolarum | aetas 23 | coelebs |
Testes: Gregorius Lesiw, Basilius Dubelowskyj, agricolae | 
Adnotation: Matrimonio benedixit Vladimirus Ławoczka.

Death Record Example for transcription output:

{{MAIN_VILLAGE_NAME}}, дом 70
Василий Юрьевич Федоришин (1806 - 01/05/1836), умер от оспы в 30 лет, сын Юрия Федоришина.
Заметки: Кратко другие факты из записи если есть.

{{MAIN_VILLAGE_NAME}}, будинок 70
Василь Юрійович Федоришин (1806 - 01/05/1836), помер від віспи у 30 років, син Юрія Федоришина.

{{MAIN_VILLAGE_NAME_LATIN}}, domus 3
15 17 Augusti 1848 | domus 3 | Catharina Joannis Hulik subditi {{MAIN_VILLAGE_NAME_LATIN}}ensis uxor. S.S. Sacramentis provisa. | Catholica: 1 | Foemina: 1 | 41 annos | Ordinaria.


#### Instructions

Step 1: Page Header Extraction

Extract any metadata from the top of the page, including:
Year of the record.
Page number (Pagina).
Archival signatures (Fond/Opis/Case if visible - look for "Fond {{FOND_NUMBER}}").
Village names listed in the header.

Step 2: Record Extraction

Second, provide a structured summary in Russian and Ukrainian and Latin transcription for each record based on record output format requirements above.

2. Original Latin Transcription Note

Transcription Accuracy:
Transcribe the text exactly as it appears, preserving original spelling, abbreviations, and orthography.
If handwriting is unclear, provide the most likely transcription and note uncertainty in square brackets, e.g., [illegible] or [possibly Anna].
Village name may appear on header of the document, also sometime included to Nrus Docume column under house number. 