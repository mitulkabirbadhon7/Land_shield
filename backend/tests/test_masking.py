from app.utils.masking import mask_name


def test_mask_name_bangla():
    assert mask_name("মোহাম্মদ রফিকুল") == "মো***দ র***ল"
    assert mask_name("রহিম উদ্দিন") == "র***ম উ***ন"
    assert mask_name("মিতুল") == "মি***ল"
    assert mask_name("মা") == "মা"


def test_mask_name_latin():
    assert mask_name("ABC XYZ") == "A***C X***Z"
    assert mask_name("Ali") == "A***i"
    assert mask_name("John Doe") == "J***n D***e"


def test_mask_name_short_and_edge_cases():
    assert mask_name("") == ""
    assert mask_name(None) == ""
    assert mask_name("   ") == ""
    assert mask_name("মা") == "মা"

