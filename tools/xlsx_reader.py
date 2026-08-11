"""Lector XLSX mínimo basado en la biblioteca estándar.

Soporta celdas de texto compartido, texto inline, booleanos y números. Se usa
para fuentes tabulares simples y evita exigir Excel u openpyxl al reconstruir
los datos estáticos.
"""

from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"x": MAIN_NS, "r": DOC_REL_NS}


def _column_index(reference):
    letters = "".join(char for char in reference if char.isalpha())
    index = 0
    for char in letters.upper():
        index = index * 26 + ord(char) - 64
    return index - 1


def _shared_strings(archive):
    try:
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    values = []
    for item in root.findall("x:si", NS):
        values.append("".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t")))
    return values


def _sheet_path(archive, requested_name=None):
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    rels = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(f"{{{PKG_REL_NS}}}Relationship")
    }
    sheets = workbook.find("x:sheets", NS)
    if sheets is None:
        raise ValueError("El XLSX no contiene hojas")
    selected = None
    for sheet in sheets:
        name = sheet.attrib.get("name")
        if requested_name is None or name == requested_name:
            selected = sheet
            break
    if selected is None:
        raise ValueError(f"No existe la hoja {requested_name!r}")
    target = targets[selected.attrib[f"{{{DOC_REL_NS}}}id"]].lstrip("/")
    return target if target.startswith("xl/") else f"xl/{target}"


def iter_xlsx_rows(path, sheet_name=None):
    path = Path(path)
    with ZipFile(path) as archive:
        shared = _shared_strings(archive)
        sheet_path = _sheet_path(archive, sheet_name)
        with archive.open(sheet_path) as stream:
            for _, element in ElementTree.iterparse(stream, events=("end",)):
                if element.tag != f"{{{MAIN_NS}}}row":
                    continue
                values = []
                for cell in element.findall("x:c", NS):
                    column = _column_index(cell.attrib.get("r", "A1"))
                    while len(values) <= column:
                        values.append(None)
                    cell_type = cell.attrib.get("t")
                    value_node = cell.find("x:v", NS)
                    if cell_type == "inlineStr":
                        inline = cell.find("x:is", NS)
                        value = "".join(node.text or "" for node in inline.iter(f"{{{MAIN_NS}}}t")) if inline is not None else ""
                    elif value_node is None:
                        value = None
                    elif cell_type == "s":
                        value = shared[int(value_node.text)]
                    elif cell_type == "b":
                        value = value_node.text == "1"
                    elif cell_type in {"str", "e"}:
                        value = value_node.text
                    else:
                        raw = value_node.text or ""
                        try:
                            number = float(raw)
                            value = int(number) if number.is_integer() else number
                        except ValueError:
                            value = raw
                    values[column] = value
                yield values
                element.clear()

