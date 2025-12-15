use std::fs;

#[test]
fn root_path_is_dot_and_kind_directory() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let json_path = format!("{}/../../tools/metrics/ryoiki.cc.json", manifest_dir);
    let txt = match fs::read_to_string(&json_path) {
        Ok(s) => s,
        Err(e) => panic!("read ryoiki.cc.json failed: {}", e),
    };
    let v: serde_json::Value = match serde_json::from_str(&txt) {
        Ok(val) => val,
        Err(e) => panic!("parse json failed: {}", e),
    };
    assert_eq!(v.get("kind").and_then(|k| k.as_str()), Some("directory"));
    assert_eq!(v.get("path").and_then(|p| p.as_str()), Some("."));
}
