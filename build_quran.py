#!/usr/bin/env python3
"""
يولّد public/data/quran-text.json من نصوص Tanzil الأصلية (بدون أي تعديل على النص).

المصدر: Tanzil Project — https://tanzil.net  (ترخيص CC BY 3.0، النسخ الحرفي فقط)
النسخ المستخدمة (مأخوذة حرفياً من ملفات txt-2 الرسمية، انظر tools/tanzil/SOURCES.json):
  - uthmani       : الرسم العثماني (للعرض)
  - simple        : الرسم الإملائي مع التشكيل (للعرض وللصوت الآلي)
  - simple-clean  : الإملائي بدون تشكيل (للمقارنة مع ما يكتبه المستخدم)

العملية الوحيدة: فصل البسملة الملحقة بأول آية في ملفات Tanzil (لكل السور عدا الفاتحة والتوبة)
لأنها ليست جزءاً من الآية. لا يُغيَّر أي حرف آخر.

الاستعمال:  python3 tools/build_quran.py 1 103 108 112 113 114
(بدون أرقام: يستخدم القائمة الافتراضية أدناه)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data", "quran-text.json")

DEFAULT_SURAHS = [1, 103, 108, 112, 113, 114]
NAMES = {1: "الفاتحة", 103: "العصر", 108: "الكوثر", 112: "الإخلاص", 113: "الفلق", 114: "الناس"}


def load(name):
    with open(os.path.join(HERE, "tanzil", name + ".json"), encoding="utf-8") as f:
        return json.load(f)


def main():
    surahs = [int(x) for x in sys.argv[1:]] or DEFAULT_SURAHS
    texts = {k: load(k) for k in ("uthmani", "simple", "simple-clean")}
    # البسملة كما في الفاتحة 1:1 في كل نسخة
    basmala = {k: texts[k]["1"][0]["text"] for k in texts}

    out = {
        "source": "Tanzil Project — https://tanzil.net",
        "license": "Tanzil Quran Text, Copyright (C) 2007-2021 Tanzil Project. CC BY 3.0 — "
                   "Permission is granted to copy and distribute verbatim copies of this text, "
                   "but CHANGING IT IS NOT ALLOWED. https://tanzil.net/docs/text_license",
        "versions": "uthmani / simple / simple-clean (txt-2). Snapshot via github.com/risan/quran-json",
        "note": "Basmala prefixed to verse 1 in Tanzil files is separated into 'basmala' (surahs other than 1 and 9).",
        "surahs": {},
    }

    for s in surahs:
        key = str(s)
        verses = []
        has_basmala = False
        for i in range(len(texts["uthmani"][key])):
            row = {}
            for k in texts:
                t = texts[k][key][i]["text"]
                if s not in (1, 9) and i == 0 and t.startswith(basmala[k] + " "):
                    t = t[len(basmala[k]) + 1:]
                    has_basmala = True
                row[k] = t
            w = {k: row[k].split(" ") for k in row}
            n = len(w["uthmani"])
            if not (len(w["simple"]) == n == len(w["simple-clean"])):
                sys.exit(f"word count mismatch in {s}:{i+1}: {[len(x) for x in w.values()]}")
            verses.append({
                "n": i + 1,
                "uthmani": row["uthmani"],
                "simple": row["simple"],
                "clean": row["simple-clean"],
                "words": [{"u": w["uthmani"][j], "s": w["simple"][j], "c": w["simple-clean"][j]} for j in range(n)],
            })
        out["surahs"][key] = {"name": NAMES.get(s, key), "basmala": has_basmala, "ayat": verses}
        print(f"surah {s}: {len(verses)} ayat, {sum(len(v['words']) for v in verses)} words")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
