use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Metrics {
    pub loc: u32,
    pub complexity: Option<u32>,
    pub functions: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CodeTree {
    pub name: String,
    pub path: String,
    pub kind: String, // "file" or "directory"
    pub metrics: Metrics,
    pub language: Option<String>,
    pub children: Option<Vec<CodeTree>>,
}

#[derive(Serialize, Deserialize)]
pub struct RectNode {
    pub path: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub depth: u32,
    pub metrics: Metrics,
    pub language: Option<String>,
}

#[wasm_bindgen]
pub fn parse_cc_json(json: &str) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let tree: CodeTree = serde_json::from_str(json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    serde_wasm_bindgen::to_value(&tree)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn layout_treemap(tree_js: &JsValue, width: f32, height: f32) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let tree: CodeTree = serde_wasm_bindgen::from_value(tree_js.clone())
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

    let mut rects = Vec::new();
    layout_node(&tree, 0.0, 0.0, width, height, 0, &mut rects);

    serde_wasm_bindgen::to_value(&rects)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn get_language_colors() -> Result<JsValue, JsValue> {
    let mut colors = HashMap::new();
    colors.insert("default".to_string(), "#6b7280".to_string());
    colors.insert("typescript".to_string(), "#3178c6".to_string());
    colors.insert("javascript".to_string(), "#f1e05a".to_string());
    colors.insert("rust".to_string(), "#dea584".to_string());
    colors.insert("python".to_string(), "#3572A5".to_string());
    colors.insert("java".to_string(), "#b07219".to_string());
    colors.insert("go".to_string(), "#00ADD8".to_string());
    colors.insert("cpp".to_string(), "#f34b7d".to_string());
    colors.insert("c".to_string(), "#555555".to_string());
    colors.insert("csharp".to_string(), "#178600".to_string());
    colors.insert("php".to_string(), "#4F5D95".to_string());
    colors.insert("ruby".to_string(), "#701516".to_string());
    colors.insert("kotlin".to_string(), "#A97BFF".to_string());
    colors.insert("swift".to_string(), "#F05138".to_string());
    colors.insert("scala".to_string(), "#DC322F".to_string());
    colors.insert("shell".to_string(), "#89e051".to_string());
    colors.insert("powershell".to_string(), "#012456".to_string());
    colors.insert("html".to_string(), "#E34C26".to_string());
    colors.insert("css".to_string(), "#563d7c".to_string());
    colors.insert("json".to_string(), "#cccccc".to_string());
    colors.insert("yaml".to_string(), "#cb171e".to_string());
    colors.insert("toml".to_string(), "#9c4221".to_string());
    colors.insert("xml".to_string(), "#9cdcfe".to_string());
    colors.insert("svelte".to_string(), "#ff3e00".to_string());
    colors.insert("objective-c".to_string(), "#438eff".to_string());
    colors.insert("objective-cpp".to_string(), "#6866fb".to_string());
    colors.insert("ocaml".to_string(), "#ef7a00".to_string());
    colors.insert("haskell".to_string(), "#5e5086".to_string());
    colors.insert("r".to_string(), "#198ce7".to_string());
    colors.insert("sql".to_string(), "#c97b0f".to_string());
    colors.insert("proto".to_string(), "#b2b7f8".to_string());
    colors.insert("graphql".to_string(), "#e10098".to_string());
    colors.insert("terraform".to_string(), "#5c4ee5".to_string());
    colors.insert("hcl".to_string(), "#3f6".to_string());
    colors.insert("nix".to_string(), "#7ebae4".to_string());
    colors.insert("dart".to_string(), "#00B4AB".to_string());
    colors.insert("elm".to_string(), "#60B5CC".to_string());
    colors.insert("groovy".to_string(), "#e69f56".to_string());
    colors.insert("gradle".to_string(), "#02303A".to_string());
    colors.insert("markdown".to_string(), "#083fa1".to_string());
    colors.insert("restructuredtext".to_string(), "#4b2f20".to_string());
    colors.insert("ini".to_string(), "#7d8c7c".to_string());
    colors.insert("batch".to_string(), "#C1F12E".to_string());
    colors.insert("make".to_string(), "#427819".to_string());
    colors.insert("docker".to_string(), "#1D63ED".to_string());
    colors.insert("cmake".to_string(), "#0CA4C3".to_string());
    colors.insert("bazel".to_string(), "#006400".to_string());
    colors.insert("unknown".to_string(), "#cccccc".to_string());
    colors.insert("mixed".to_string(), "#999999".to_string());

    serde_wasm_bindgen::to_value(&colors)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

fn layout_node(
    node: &CodeTree,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    depth: u32,
    rects: &mut Vec<RectNode>,
) {
    if node.kind == "file" {
        rects.push(RectNode {
            path: node.path.clone(),
            x,
            y,
            width,
            height,
            depth,
            metrics: node.metrics.clone(),
            language: node.language.clone(),
        });
        return;
    }

    if let Some(children) = &node.children {
        let total_loc: u32 = children.iter().map(|child| child.metrics.loc).sum();

        if total_loc == 0 {
            return;
        }

        let mut current_x = x;
        let mut current_y = y;

        for child in children {
            let child_ratio = child.metrics.loc as f32 / total_loc as f32;

            if width > height {
                let child_width = width * child_ratio;
                layout_node(
                    child,
                    current_x,
                    current_y,
                    child_width,
                    height,
                    depth + 1,
                    rects,
                );
                current_x += child_width;
            } else {
                let child_height = height * child_ratio;
                layout_node(
                    child,
                    current_x,
                    current_y,
                    width,
                    child_height,
                    depth + 1,
                    rects,
                );
                current_y += child_height;
            }
        }
    }
}
