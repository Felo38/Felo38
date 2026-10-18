export interface Branch {
  id: string
  name: string
  address: string
  addressEn: string
  mapsUrl: string
  // Filled in once coordinates are known. Branches without them are skipped by "nearest".
  lat: number | null
  lng: number | null
}

export const branches: Branch[] = [
  {
    "id": "otr-cornich",
    "name": "Cornich",
    "address": "1017 كورنيش النيل",
    "addressEn": "1017 Cornich El Nile St, Maadi, Cairo Governorate",
    "mapsUrl": "https://maps.app.goo.gl/J6sDqqa6CTWzBGf27",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-maadi-towers",
    "name": "Maadi Towers",
    "address": "شارع حلوان الزراعى - ابراج عثمان - المعادى",
    "addressEn": "Masr - Helwan Agriculture Rd, Maadi Al Khabiri Al Wasti, Maadi, Cairo Governorate 4211212",
    "mapsUrl": "https://maps.app.goo.gl/J4qaAZ5gSvAqUeRT6",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-cfc",
    "name": "Cfc",
    "address": "جنوب الكاديمية ميدان العروبة بجوار مسجد الشرطة التجمع الخامس",
    "addressEn": "2CJF+638, New Cairo 1, Cairo Governorate 4731027",
    "mapsUrl": "https://maps.app.goo.gl/sg9qZVG3hLDQbh5M7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-hegaz",
    "name": "Hegaz",
    "address": "46 ش الحجاز هليوبوليس",
    "addressEn": "46 El Hegaz St, El-Nozha, El Nozha, Cairo Governorate 4470035",
    "mapsUrl": "https://maps.app.goo.gl/KpPbM7Jd2owNbNob9",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-rehab",
    "name": "Rehab",
    "address": "بوابة 13 مدينة الرحاب - القاهرة الجديدة",
    "addressEn": "بوابة 13, Mohammed Nagib Axis, Second New Cairo, Cairo Governorate 4750060",
    "mapsUrl": "https://maps.app.goo.gl/hFarr4Zs3ik24ZWv7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-airport",
    "name": "Airport",
    "address": "33 ش جوزيف تيتو - طريق مصر إسماعيلية",
    "addressEn": "Joseph Tito St, Huckstep, El Nozha, Cairo Governorate 4473326",
    "mapsUrl": "https://maps.app.goo.gl/8Be5xP8itmtBj9EB8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-mautain-view",
    "name": "Mautain View",
    "address": "قطعة ارض G1 بمنطقة G بالقطاع الرابع -منطقى اللوتس محمود م بن زايد التجمع الخامس",
    "addressEn": "2GJH+764, New Cairo 1, Cairo Governorate 4743027",
    "mapsUrl": "https://maps.app.goo.gl/UAgUC5WAjUqaQjZ49",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-dokki",
    "name": "Dokki",
    "address": "50 ش مراد - امام مجلس الدولة - الدقي",
    "addressEn": "50 Mourad St El Dokki Giza EG-GZ EG 12611, 50 Mourad, Oula, Al Giza",
    "mapsUrl": "https://maps.app.goo.gl/n5vB5MvLiEdn9J359",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-october",
    "name": "October",
    "address": "نهاية محور 26 يوليو - مدخل مدينة 6 اكتوبر - ميدان جهينه",
    "addressEn": "Mehwar, 26th of July Corridor, Giza Governorate",
    "mapsUrl": "https://maps.app.goo.gl/H1MEVMQq2Qa542tV8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-orabi",
    "name": "Orabi",
    "address": "16 ش رمسيس",
    "addressEn": "Oraby, Al Azbakeya, Cairo Governorate 4320013",
    "mapsUrl": "https://maps.app.goo.gl/xqjZ3KuFcbibFBXt8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-bakry",
    "name": "Bakry",
    "address": "21ش الخليفة المأمون - مصر الجديدة - القاهرة",
    "addressEn": "21 ش El-Khalifa El-Maamoun, Manshîyet el Bakri, Heliopolis, Cairo Governorate 4460050",
    "mapsUrl": "https://maps.app.goo.gl/e4UkLs5WYb5rSbeu7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-nour",
    "name": "Nour",
    "address": "تقاطع طريق السويس مع  الدائرى - بجوار ماريوت ميراج",
    "addressEn": "Mehwar, Naguib Mahfouz, Cairo Governorate 11835",
    "mapsUrl": "https://maps.app.goo.gl/kgq66ZmHpWkVARpz7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-zayed",
    "name": "Zayed",
    "address": "نهاية محور 26 يوليو - بجوار هايبر وان",
    "addressEn": "First Al Sheikh Zayed, Giza Governorate 12573",
    "mapsUrl": "https://maps.app.goo.gl/uHpj8J8WpdM4KoiA6",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-mohandseen",
    "name": "Mohandseen",
    "address": "27 ش البطل احمد عبد العزيز",
    "addressEn": "27 El-Batal Ahmed Abd El-Aziz, Al Huwaiteyah, Agouza, Giza Governorate 12655",
    "mapsUrl": "https://maps.app.goo.gl/agM5JNMEKvK41jCh8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-smouha",
    "name": "Smouha",
    "address": "شارع 14مايو امام المركز الطبى سموحة",
    "addressEn": "Ezbet Saad, Sidi Gaber, Alexandria Governorate 5432074",
    "mapsUrl": "https://maps.app.goo.gl/2UALBhZEHW5gwHm79",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-oroba",
    "name": "Oroba",
    "address": "48أ ش العروبة - مصر الجديدة",
    "addressEn": "48 A El-Orouba, St، Heliopolis, Cairo Governorate 11771",
    "mapsUrl": "https://maps.app.goo.gl/ScGucrqQi6TpZ7xs5",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-tagamoa",
    "name": "Tagamoa",
    "address": "القطعة 33 - منطقة الخدمات - التجمع الخامس ـ القاهرة الجديدة",
    "addressEn": "Akhnaton st, New Cairo, Mobil Gas Station, Plot 33, Services Area, Cairo, EG-C 11835",
    "mapsUrl": "https://maps.app.goo.gl/7pPp6saSneeGF17D7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-merghany",
    "name": "Merghany",
    "address": "66 شارع الميرغنى - مصر الجديدة",
    "addressEn": "66 الميرغني, St, Heliopolis, Cairo Governorate 11771",
    "mapsUrl": "https://maps.app.goo.gl/va2Pjn4th582dwhP8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-fardous",
    "name": "Fardous",
    "address": "طريق الواحات مدينة السادس من أكتوبر",
    "addressEn": "El Wahat Rd, First 6th of October, 6th of October City (3), Giza Governorate 3281450",
    "mapsUrl": "https://maps.app.goo.gl/MwguYTUPMERpoYH69",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-sphinx",
    "name": "Sphinx",
    "address": "محطة موبيل الكيلو 28 طريق القاهرة الاسكندرية الصحراوي بجوار داندي مول",
    "addressEn": "On the Run محطة موبيل, Kilo 28 Cairo - Alexandria Desert Rd, Kerdasa, Giza Governorate 12577",
    "mapsUrl": "https://maps.app.goo.gl/rq3xmQu4Avgm9cq99",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-roxy",
    "name": "Roxy",
    "address": "72 ش الخليفة المأمون هليوبوليس",
    "addressEn": "72 El-Khalifa El-Maamoun, Manshîyet el Bakri, Heliopolis, Cairo Governorate 11774",
    "mapsUrl": "https://maps.app.goo.gl/2ACtoYLShnKP86YS8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-autostrad",
    "name": "Autostrad",
    "address": "188 الملتفى العربى طريق مساكن شيراتون امتداد الاوتوستراد",
    "addressEn": "39Q9+JJF, Sheraton Al Matar, El Nozha, Cairo Governorate 4472002",
    "mapsUrl": "https://maps.app.goo.gl/QhuPSokcKFxYFDYx8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-madinaty",
    "name": "Madinaty",
    "address": "المدخل الشمالى امتداد مدينتى - بوابة 2 - لقاهرة الجديدة",
    "addressEn": "4J6J+8X, Second New Cairo, Cairo Governorate 4771701",
    "mapsUrl": "https://maps.app.goo.gl/Wu7TvfwE1sHkSNca6",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-battal",
    "name": "Battal",
    "address": "16 ش البطل احمد عبد العزيز",
    "addressEn": "11 El-Batal Ahmed Abd El-Aziz, Al Huwaiteyah, Agouza, Giza Governorate 3751333",
    "mapsUrl": "https://maps.app.goo.gl/zKUYwaJc4Zsr59Uy8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-oberoi",
    "name": "Oberoi",
    "address": "11أ طريق القاهرة الاسكندرية الصحراوي بجوار ميدان الرمايه",
    "addressEn": "Zahret Al Nile, Kafr Nassar, Al Haram, محافظة القاهرة‬ 3514801",
    "mapsUrl": "https://maps.app.goo.gl/YVBNVRiAHVDJzpYp7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-amerya",
    "name": "Amerya",
    "address": "7 ش ابراهيم نصير-ك 30 طريق الاسكندرية -القاهرة الصحراوي",
    "addressEn": "Km 30.5 Alex Cairo Desert Rd, Amreya, Alexandria, EG-ALX 23511",
    "mapsUrl": "https://maps.app.goo.gl/egoeGQP3JLg1WZjp8",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-mariotya",
    "name": "Mariotya",
    "address": "نزلة المريوطية على الطريق الدائرى",
    "addressEn": "قهوة البوابة ولعة, Al Kenisah, El Talbia, Cairo Governorate 3535001",
    "mapsUrl": "https://maps.app.goo.gl/YVBNVRiAHVDJzpYp7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-almaza",
    "name": "Almaza",
    "address": "66 ش النزهة -  مصر الجديدة",
    "addressEn": "66 النزهة St قسم مصر الجديدة، 66 El-Nozha, Almazah, Heliopolis, Cairo Governorate 11771",
    "mapsUrl": "https://maps.app.goo.gl/efPjcqr9P62G2aTEA",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-manial",
    "name": "Manial",
    "address": "59 ش على الشريف ناصية ش المنيل",
    "addressEn": "59 Al Manial, Al Manyal Al Gharbi, Old Cairo, Cairo Governorate 4240264",
    "mapsUrl": "https://maps.app.goo.gl/G88EoaeePcoAzuU57",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-new-maadi",
    "name": "New Maadi",
    "address": "584 تقاطع ش اللاسلكي مع شارع فلسطين  - المعادى الجديدة",
    "addressEn": "New Maadi, Street 300, El-Basatin Sharkeya, El Basatin, Cairo Governorate",
    "mapsUrl": "https://maps.app.goo.gl/gjTts4Ex4W3rNu7h6",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-gamaa",
    "name": "Gamaa",
    "address": "18 ش الجزائر متفرع من ش جامعة الدول العربية - المهندسين",
    "addressEn": "18 Al Gazaer, St, Agouza, Giza Governorate 12655",
    "mapsUrl": "https://maps.app.goo.gl/L3VXMiv8WAVY7jes5",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-narges-2",
    "name": "Narges 2",
    "address": "النرجس 4 حى النرجس - فيلات بجوار مسجد المصطفى التجمع الخامس القاهرة الجديدة",
    "addressEn": "2F44+M6G Factory، No. 865, New Cairo 1, Cairo Governorate 4724110",
    "mapsUrl": "https://maps.app.goo.gl/XNeXheNSZz16ZxA17",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-auc",
    "name": "Auc",
    "address": "قطعة 18 اللوتس الجانوبية أمام سوديك 1 - شارع التسعين الجنوبي - التجمع الخامس االقاهرة الجديدة",
    "addressEn": "2G88+2HM, New Cairo 1, Cairo Governorate 4728114",
    "mapsUrl": "https://maps.app.goo.gl/xp7sjT8Lxnm2digj7",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-narges-1",
    "name": "Narges 1",
    "address": "المنطقة البينية بين النرجس فيلات والنرجس عمارات- التجمع الخامس- القاهرة الجديدة - محور جمال عبد الناصر",
    "addressEn": "XFX6+XQ9, Gamal Abdel Nasser, Industrial Area, New Cairo 1, Cairo Governorate 11835",
    "mapsUrl": "https://maps.app.goo.gl/51G4WjKGJ9TD28Z57",
    "lat": null,
    "lng": null
  },
  {
    "id": "otr-hurghada",
    "name": "Hurghada",
    "address": "تقاطع شارع النصر مع الكهف في اتجاه الجونة",
    "addressEn": "Hurghada 2, Red Sea Governorate 1982404",
    "mapsUrl": "https://maps.app.goo.gl/tQTiYLvVSRENFAqi9",
    "lat": null,
    "lng": null
  }
]
