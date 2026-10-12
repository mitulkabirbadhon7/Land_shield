from app.utils.masking import mask_name


def test_mask_name_bangla():
    assert mask_name("রহিম উদ্দিন") == "র***ম উ***ন"
    assert mask_name("তারিকুল ইসলাম") == "ত***ল ই***ম"


def test_mask_name_latin():
    assert mask_name("John Doe") == "J***n D***e"
    assert mask_name("Alice Wonder") == "A***e W***r"


def test_mask_name_short_and_edge_cases():
    assert mask_name("Md Ali") == "M***d A***i"
    assert mask_name("A") == "A***"
    assert mask_name("") == ""
    assert mask_name(None) == ""
    assert mask_name("   ") == ""
    assert mask_name("X Y Z") == "X*** Y*** Z***"
