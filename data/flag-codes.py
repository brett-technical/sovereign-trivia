#!/usr/bin/env python3
"""Country name -> ISO 3166-1 alpha-2, for flag filenames.

Written out in full rather than fuzzy-matched: a wrong flag is a wrong fact,
and the intent says wrong trivia is worse than none. Kosovo uses the
user-assigned code XK, which is what circle-flags ships it under.
"""

ISO2 = {
 # --- Africa (54) ---
 "Algeria":"dz","Angola":"ao","Benin":"bj","Botswana":"bw","Burkina Faso":"bf",
 "Burundi":"bi","Cabo Verde":"cv","Cameroon":"cm","Central African Republic":"cf",
 "Chad":"td","Comoros":"km","Congo (Democratic Republic of the)":"cd",
 "Congo (Republic of the)":"cg","Cote d'Ivoire":"ci","Djibouti":"dj","Egypt":"eg",
 "Equatorial Guinea":"gq","Eritrea":"er","Eswatini":"sz","Ethiopia":"et",
 "Gabon":"ga","Gambia":"gm","Ghana":"gh","Guinea":"gn","Guinea-Bissau":"gw",
 "Kenya":"ke","Lesotho":"ls","Liberia":"lr","Libya":"ly","Madagascar":"mg",
 "Malawi":"mw","Mali":"ml","Mauritania":"mr","Mauritius":"mu","Morocco":"ma",
 "Mozambique":"mz","Namibia":"na","Niger":"ne","Nigeria":"ng","Rwanda":"rw",
 "Sao Tome and Principe":"st","Senegal":"sn","Seychelles":"sc","Sierra Leone":"sl",
 "Somalia":"so","South Africa":"za","South Sudan":"ss","Sudan":"sd","Tanzania":"tz",
 "Togo":"tg","Tunisia":"tn","Uganda":"ug","Zambia":"zm","Zimbabwe":"zw",
 # --- Asia (48) ---
 "Afghanistan":"af","Armenia":"am","Azerbaijan":"az","Bahrain":"bh",
 "Bangladesh":"bd","Bhutan":"bt","Brunei":"bn","Cambodia":"kh","China":"cn",
 "Georgia":"ge","India":"in","Indonesia":"id","Iran":"ir","Iraq":"iq",
 "Israel":"il","Japan":"jp","Jordan":"jo","Kazakhstan":"kz","Kuwait":"kw",
 "Kyrgyzstan":"kg","Laos":"la","Lebanon":"lb","Malaysia":"my","Maldives":"mv",
 "Mongolia":"mn","Myanmar (Burma)":"mm","Nepal":"np","North Korea":"kp",
 "Oman":"om","Pakistan":"pk","Palestine":"ps","Philippines":"ph","Qatar":"qa",
 "Saudi Arabia":"sa","Singapore":"sg","South Korea":"kr","Sri Lanka":"lk",
 "Syria":"sy","Taiwan":"tw","Tajikistan":"tj","Thailand":"th","Timor-Leste":"tl",
 "Turkey":"tr","Turkmenistan":"tm","United Arab Emirates":"ae","Uzbekistan":"uz",
 "Vietnam":"vn","Yemen":"ye",
 # --- Europe (46) ---
 "Albania":"al","Andorra":"ad","Austria":"at","Belarus":"by","Belgium":"be",
 "Bosnia and Herzegovina":"ba","Bulgaria":"bg","Croatia":"hr","Cyprus":"cy",
 "Czechia":"cz","Denmark":"dk","Estonia":"ee","Finland":"fi","France":"fr",
 "Germany":"de","Greece":"gr","Holy See (Vatican City)":"va","Hungary":"hu",
 "Iceland":"is","Ireland":"ie","Italy":"it","Kosovo":"xk","Latvia":"lv",
 "Liechtenstein":"li","Lithuania":"lt","Luxembourg":"lu","Malta":"mt",
 "Moldova":"md","Monaco":"mc","Montenegro":"me","Netherlands":"nl",
 "North Macedonia":"mk","Norway":"no","Poland":"pl","Portugal":"pt",
 "Romania":"ro","Russia":"ru","San Marino":"sm","Serbia":"rs","Slovakia":"sk",
 "Slovenia":"si","Spain":"es","Sweden":"se","Switzerland":"ch","Ukraine":"ua",
 "United Kingdom":"gb",
 # --- Americas (35) ---
 "Antigua and Barbuda":"ag","Argentina":"ar","Bahamas":"bs","Barbados":"bb",
 "Belize":"bz","Bolivia":"bo","Brazil":"br","Canada":"ca","Chile":"cl",
 "Colombia":"co","Costa Rica":"cr","Cuba":"cu","Dominica":"dm",
 "Dominican Republic":"do","Ecuador":"ec","El Salvador":"sv","Grenada":"gd",
 "Guatemala":"gt","Guyana":"gy","Haiti":"ht","Honduras":"hn","Jamaica":"jm",
 "Mexico":"mx","Nicaragua":"ni","Panama":"pa","Paraguay":"py","Peru":"pe",
 "Saint Kitts and Nevis":"kn","Saint Lucia":"lc",
 "Saint Vincent and the Grenadines":"vc","Suriname":"sr",
 "Trinidad and Tobago":"tt","United States":"us","Uruguay":"uy","Venezuela":"ve",
 # --- Oceania (14) ---
 "Australia":"au","Fiji":"fj","Kiribati":"ki","Marshall Islands":"mh",
 "Micronesia (Federated States of)":"fm","Nauru":"nr","New Zealand":"nz",
 "Palau":"pw","Papua New Guinea":"pg","Samoa":"ws","Solomon Islands":"sb",
 "Tonga":"to","Tuvalu":"tv","Vanuatu":"vu",
}

if __name__ == "__main__":
    import json, pathlib, sys
    root = pathlib.Path(__file__).resolve().parent.parent
    data = json.loads((root/"data/countries.json").read_text(encoding="utf-8"))
    names = [c["country"] for c in data]
    missing = [n for n in names if n not in ISO2]
    extra   = [n for n in ISO2 if n not in names]
    dupes   = {v for v in ISO2.values() if list(ISO2.values()).count(v) > 1}
    print(f"countries: {len(names)}  mapped: {len(ISO2)}")
    print(f"missing mapping : {missing or 'none'}")
    print(f"extra  mapping  : {extra or 'none'}")
    print(f"duplicate codes : {dupes or 'none'}")
    if missing or extra or dupes:
        sys.exit(1)
