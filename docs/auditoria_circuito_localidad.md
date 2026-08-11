# Auditoría circuito–localidad contra localidades censales oficiales

Generado: 2026-08-10T09:20:48

## Objetivo

Evaluar si la etiqueta de localidad asignada a cada circuito electoral es nominal y espacialmente compatible con la capa de localidades censales bonaerenses de más de 2.000 habitantes.
Esta auditoría es independiente de la relación radio censal–circuito y no modifica la agregación vigente de la app.

## Método

- Los nombres oficiales se recuperan por el código CLC de ocho dígitos mediante el nomenclador Georef.
- Las geometrías inválidas se informan y se reparan solo en memoria con `make_valid` para calcular intersecciones.
- Se calcula la intersección poligonal exacta entre cada localidad y cada circuito candidato.
- Una intersección se considera significativa cuando cubre al menos 0,1 % del área de la localidad o contiene su centroide oficial.
- Los porcentajes de área son proporciones planares en CRS84 y no representan km².

## Resumen

- Circuitos auditados: **1153**.
- Circuitos con localidad asignada: **726**.
- Circuitos con localidad vacía: **427**.
- Localidades oficiales auditadas: **219**.
- Diferencias entre el XLSX y el GeoJSON actual de la app: **0**.
- Códigos CLC sin nombre en Georef: **0**.

| estado | circuitos |
| --- | --- |
| blank_with_official_overlap | 4 |
| blank_without_official_overlap | 423 |
| label_matches_other_party | 159 |
| same_party_label_without_spatial_overlap | 38 |
| valid_same_party_spatial | 529 |

## Cobertura de las localidades oficiales

| estado | localidades |
| --- | --- |
| official_locality_not_represented | 24 |
| represented_in_assignment | 195 |

## Etiquetas que corresponden a otro partido

| partido circuito | etiqueta Excel | partido oficial de la etiqueta | circuitos |
| --- | --- | --- | --- |
| La Plata | Ensenada | Ensenada | 7 |
| Lanús | Avellaneda | Avellaneda | 6 |
| Pilar | José C. Paz | José C. Paz | 5 |
| Pilar | Escobar | Escobar | 5 |
| Florencio Varela | Berazategui | Berazategui | 5 |
| Lomas De Zamora | Lanús | Lanús | 5 |
| La Plata | Berisso | Berisso | 5 |
| San Isidro | San Fernando | San Fernando | 4 |
| Tres De Febrero | General San Martín | General San Martín | 4 |
| La Matanza | Ezeiza | Ezeiza | 3 |
| Vicente López | San Isidro | San Isidro | 3 |
| Tigre | San Fernando | San Fernando | 3 |
| Tigre | Escobar | Escobar | 3 |
| Presidente Perón | Almirante Brown | Almirante Brown | 3 |
| Morón | La Matanza | La Matanza | 3 |
| Esteban Echeverría | Almirante Brown | Almirante Brown | 3 |
| San Miguel | José C. Paz | José C. Paz | 3 |
| Florencio Varela | Almirante Brown | Almirante Brown | 3 |
| Quilmes | Berazategui | Berazategui | 3 |
| Quilmes | Avellaneda | Avellaneda | 3 |
| Lomas De Zamora | Almirante Brown | Almirante Brown | 3 |
| La Plata | Berazategui | Berazategui | 3 |
| Moreno | Merlo | Merlo | 2 |
| Moreno | Ituzaingó | Ituzaingó | 2 |
| La Matanza | Barrio Lisandro de La Torre y Santa Marta | Marcos Paz | 2 |
| La Matanza | Esteban Echeverría | Esteban Echeverría | 2 |
| Vicente López | General San Martín | General San Martín | 2 |
| Merlo | La Matanza | La Matanza | 2 |
| Merlo | Ituzaingó | Ituzaingó | 2 |
| San Miguel | Moreno | Moreno | 2 |
| Malvinas Argentinas | José C. Paz | José C. Paz | 2 |
| Ensenada | Berazategui | Berazategui | 2 |
| Ituzaingó | Hurlingham | Hurlingham | 2 |
| Quilmes | Almirante Brown | Almirante Brown | 2 |
| Lomas De Zamora | Esteban Echeverría | Esteban Echeverría | 2 |
| Lomas De Zamora | La Matanza | La Matanza | 2 |
| General Lavalle | Mar del Tuyú - Mar de Ajó - San Bernardo | La Costa | 2 |
| Coronel Suárez | Sierra de la Ventana | Tornquist | 1 |
| General Alvarado | El Marquesado | General Pueyrredón | 1 |
| General Guido | Maipú | Maipú | 1 |
| General Juan Madariaga | Villa Gesell | Villa Gesell | 1 |
| Junín | Baigorrita | General Viamonte | 1 |
| General Las Heras | Barrio Santa Rosa | Marcos Paz | 1 |
| Marcos Paz | La Matanza | La Matanza | 1 |
| Monte | General Belgrano | General Belgrano | 1 |
| Cañuelas | Ezeiza | Ezeiza | 1 |
| Cañuelas | Barrio Lisandro de La Torre y Santa Marta | Marcos Paz | 1 |
| Lobería | Necochea - Quequén | Necochea | 1 |
| Ramallo | San Nicolás | San Nicolás | 1 |
| Patagones | Pedro Luro | Villarino | 1 |
| Moreno | General Rodríguez | General Rodríguez | 1 |
| Magdalena | La Plata | La Plata | 1 |
| Guaminí | Huanguelén | Coronel Suárez | 1 |
| Tigre | General San Martín | General San Martín | 1 |
| Presidente Perón | Esteban Echeverría | Esteban Echeverría | 1 |
| Morón | Ituzaingó | Ituzaingó | 1 |
| Morón | Merlo | Merlo | 1 |
| Morón | Hurlingham | Hurlingham | 1 |
| Merlo | Marcos Paz | Marcos Paz | 1 |
| Ezeiza | Esteban Echeverría | Esteban Echeverría | 1 |
| Exaltación De La Cruz | Campana | Campana | 1 |
| San Miguel | Hurlingham | Hurlingham | 1 |
| San Miguel | General San Martín | General San Martín | 1 |
| San Miguel | Ituzaingó | Ituzaingó | 1 |
| Pilar | Lujan | Luján | 1 |
| Pilar | Los Cardales | Exaltación de la Cruz | 1 |
| Pilar | General Rodríguez | General Rodríguez | 1 |
| Pilar | Campana | Campana | 1 |
| Luján | General Rodríguez | General Rodríguez | 1 |
| Ensenada | Berisso | Berisso | 1 |
| San Isidro | General San Martín | General San Martín | 1 |
| Tres De Febrero | Hurlingham | Hurlingham | 1 |
| Tres De Febrero | Morón | Morón | 1 |
| Tres De Febrero | La Matanza | La Matanza | 1 |
| Quilmes | Florencio Varela | Florencio Varela | 1 |
| San Pedro | Baradero | Baradero | 1 |
| Pergamino | Arroyo Dulce | Salto | 1 |
| San Vicente | Barrio Parque Las Acacias | Brandsen | 1 |
| San Vicente | Florencio Varela | Florencio Varela | 1 |
| La Plata | Campos de Roca - Posada de Los Lagos | Brandsen | 1 |
| La Plata | Barrio Las Golondrinas | Brandsen | 1 |

## Partidos con más observaciones

| partido | circuitos observados |
| --- | --- |
| La Plata | 41 |
| Pilar | 14 |
| Lomas De Zamora | 12 |
| Quilmes | 9 |
| San Miguel | 8 |
| Florencio Varela | 8 |
| La Matanza | 7 |
| Tigre | 7 |
| Tres De Febrero | 7 |
| Morón | 6 |
| Lanús | 6 |
| Moreno | 5 |
| Vicente López | 5 |
| Merlo | 5 |
| San Isidro | 5 |
| Pinamar | 4 |
| Presidente Perón | 4 |
| Junín | 3 |
| Esteban Echeverría | 3 |
| Ensenada | 3 |

## Caso Pilar

| circuito | localidad Excel | estado | localidad oficial intersectada |
| --- | --- | --- | --- |
| 770F | Pilar | valid_same_party_spatial | Pilar |
| 770E | José C. Paz | label_matches_other_party | Pilar |
| 770B | José C. Paz | label_matches_other_party | Pilar |
| 770A | Pilar | valid_same_party_spatial | Pilar |
| 768A | Pilar | valid_same_party_spatial | Pilar |
| 768B | Pilar | valid_same_party_spatial | Pilar |
| 770 | Pilar | valid_same_party_spatial | Pilar |
| 769A | Lujan | label_matches_other_party | Pilar |
| 772A | Escobar | label_matches_other_party | Pilar |
| 769 | Los Cardales | label_matches_other_party | Pilar |
| 770C | José C. Paz | label_matches_other_party | Pilar |
| 770D | José C. Paz | label_matches_other_party | Pilar |
| 771D | Escobar | label_matches_other_party | Pilar |
| 771A | Escobar | label_matches_other_party | Pilar |
| 771 | Escobar | label_matches_other_party | Pilar |
| 771B | Escobar | label_matches_other_party | Pilar |
| 768C | General Rodríguez | label_matches_other_party | Pilar |
| 772 | Pilar | valid_same_party_spatial | Pilar |
| 772B | Campana | label_matches_other_party | Pilar |
| 768 | Pilar | valid_same_party_spatial | Pilar |
| 771C | José C. Paz | label_matches_other_party | Pilar |

## Calidad geométrica

- Geometrías de circuito inválidas de origen: **1**.
- Geometrías de localidad inválidas de origen: **1**.
- Las razones completas y los registros por circuito/localidad se encuentran en el JSON y los CSV asociados.

## Archivos de detalle

- `auditoria_circuito_localidad.csv`: una fila por circuito.
- `auditoria_circuito_localidad_localidades.csv`: una fila por localidad oficial.
- `auditoria_circuito_localidad.json`: evidencia completa, fuentes, parámetros y geometrías observadas.
