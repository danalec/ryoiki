use crate::metrics_calc::*;
use ignore::WalkBuilder;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokei::{Config, Languages};

#[derive(serde::Serialize)]
struct Metrics {
    loc: usize,
    complexity: usize,
    functions: usize,
}

#[derive(serde::Serialize)]
struct Node {
    name: String,
    path: String,
    kind: String,
    metrics: Metrics,
    language: Option<String>,
    children: Option<Vec<Node>>,
}

pub fn run_scan() -> Result<String, Box<dyn std::error::Error>> {
    let config_path = "tools.config.json";
    let config_content = match fs::read_to_string(config_path) {
        Ok(s) => s,
        Err(_) => "{}".to_string(),
    };
    let cfg_v = serde_json::from_str::<serde_json::Value>(&config_content).ok();

    // Setup metrics dir
    let metrics_rel: String = cfg_v
        .as_ref()
        .and_then(|v| {
            v.get("paths")
                .and_then(|p| p.get("metrics_dir"))
                .and_then(|s| s.as_str())
        })
        .map(|s| s.to_string())
        .unwrap_or_else(|| "tools/metrics".to_string());

    let project_root = std::env::current_dir()?;

    // Define excludes
    let excludes = vec![
        "target",
        "**/node_modules",
        "**/dist",
        "**/build",
        "**/npm_modules",
        ".git",
        "ryoiki.cc.json",
        "ryoiki.metrics.json",
        "**/ryoiki.cc.json",
        "**/ryoiki.metrics.json",
        "package-lock.json",
        "**/package-lock.json",
    ];

    // Determine scanning root (audit target)
    let mut audit_rel: String = cfg_v
        .as_ref()
        .and_then(|v| {
            v.get("paths")
                .and_then(|p| p.get("audit_dir"))
                .and_then(|s| s.as_str())
        })
        .map(|s| s.to_string())
        .or_else(|| {
            cfg_v.as_ref().and_then(|v| {
                v.get("audit_dir")
                    .and_then(|s| s.as_str())
                    .map(|s| s.to_string())
            })
        })
        .or_else(|| std::env::var("RYOIKI_AUDIT_DIR").ok())
        .or_else(|| std::env::var("TOKADO_AUDIT_DIR").ok())
        .unwrap_or_else(|| ".".to_string());

    while audit_rel.starts_with('/') || audit_rel.starts_with('\\') {
        audit_rel = audit_rel[1..].to_string();
    }

    let target_candidate = Path::new(&audit_rel);
    let scan_root = if target_candidate.is_absolute() {
        target_candidate.to_path_buf()
    } else {
        project_root.join(&audit_rel)
    };

    let mut languages = Languages::new();
    let tokei_config = Config::default();
    let scan_str = scan_root.to_string_lossy().to_string();

    languages.get_statistics(&[scan_str.as_str()], &excludes, &tokei_config);

    let mut total_lines = 0;
    let mut total_code = 0;
    let mut total_comments = 0;
    let mut total_files = 0;

    let mut rust_lines: usize = 0;
    let mut rust_code: usize = 0;
    let mut rust_comments: usize = 0;

    let mut lang_vec: Vec<_> = languages.iter().collect();
    lang_vec.sort_by(|(_, a), (_, b)| b.code.cmp(&a.code));

    let mut cat_totals: HashMap<String, (usize, usize, usize, usize)> = HashMap::new();

    for (lang_type, language) in lang_vec {
        let lines = language.code + language.comments + language.blanks;
        let files = language.reports.len();
        total_lines += lines;
        total_code += language.code;
        total_comments += language.comments;
        total_files += files;
        let name = lang_type.to_string();

        if name == "Rust" {
            rust_lines = lines;
            rust_code = language.code;
            rust_comments = language.comments;
        }
        let cat = classify(&name).to_string();
        let e = cat_totals.entry(cat).or_insert((0, 0, 0, 0));
        e.0 += files;
        e.1 += lines;
        e.2 += language.code;
        e.3 += language.comments;
    }

    let audit_tokens = vec![
        ".unwrap()",
        ".expect(",
        "panic!",
        "todo!",
        "dbg!",
        "unimplemented!",
        "assert!",
        "assert_eq!",
        "unsafe",
        ".clone()",
        "unwrap_or(",
        "unwrap_or_else(",
    ];
    let mut audit_counts: HashMap<String, usize> = HashMap::new();
    for t in &audit_tokens {
        audit_counts.insert(t.to_string(), 0);
    }
    let mut abc_a: usize = 0;
    let mut abc_b: usize = 0;
    let mut abc_c: usize = 0;
    let mut cc_decisions: usize = 0;
    let mut halstead_ops_unique: HashSet<String> = HashSet::new();
    let mut halstead_operands_unique: HashSet<String> = HashSet::new();
    let mut halstead_ops_total: usize = 0;
    let mut halstead_operands_total: usize = 0;
    let excludes_fs = [
        "target",
        "node_modules",
        "dist",
        "build",
        "npm_modules",
        ".git",
        "ryoiki.cc.json",
        "ryoiki.metrics.json",
        "package-lock.json",
    ];
    let mut mi_sum: f64 = 0.0;
    let mut mi_count: usize = 0;

    let gitignore: Option<Arc<Gitignore>> = {
        let mut b = GitignoreBuilder::new(&scan_root);
        let root_ign = scan_root.join(".gitignore");
        b.add(&root_ign);
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            let global_ign = std::path::Path::new(&home).join(".gitignore_global");
            if global_ign.exists() {
                b.add(&global_ign);
            }
        }
        b.build().ok().map(Arc::new)
    };

    {
        let mut visit = |p: &Path| {
            if let Ok(txt) = fs::read_to_string(p) {
                let s = sanitize(&txt);
                for t in &audit_tokens {
                    let c = count_token(&s, t);
                    if c > 0 {
                        *audit_counts.entry(t.to_string()).or_default() += c;
                    }
                }
                abc_a += count_assignments(&s);
                abc_b += count_branches(&s);
                abc_c += count_conditionals(&s);
                cc_decisions += count_cyclomatic_decisions(&s);
                let (ops_total, operands_total, ops_set, operands_set) = halstead_collect(&s);
                halstead_ops_total += ops_total;
                halstead_operands_total += operands_total;
                for op in &ops_set {
                    halstead_ops_unique.insert(op.clone());
                }
                for opd in &operands_set {
                    halstead_operands_unique.insert(opd.clone());
                }
                let orig_lines = txt.lines().count();
                let code_lines = s.lines().filter(|l| !l.trim().is_empty()).count();
                let cyclo_file = count_cyclomatic_decisions(&s) + 1;
                let n1_f = ops_set.len();
                let n2_f = operands_set.len();
                let n_f = n1_f + n2_f;
                let n_big_f = ops_total + operands_total;
                let h_vol_f = if n_f > 0 {
                    (n_big_f as f64) * ((n_f as f64).log2())
                } else {
                    0.0
                };
                let mi_raw_f = if code_lines > 0 && h_vol_f > 0.0 {
                    171.0
                        - 5.2 * (h_vol_f.ln())
                        - 0.23 * (cyclo_file as f64)
                        - 16.2 * (code_lines as f64).ln()
                } else {
                    0.0
                };
                let cm_pct_f = if orig_lines > 0 {
                    ((orig_lines.saturating_sub(code_lines)) as f64) * 100.0 / (orig_lines as f64)
                } else {
                    0.0
                };
                let mi_f = ((mi_raw_f * 100.0) / 171.0) + 50.0 * (2.4 * cm_pct_f).sqrt().sin();
                mi_sum += mi_f.clamp(0.0, 100.0);
                mi_count += 1;
            }
        };
        let excludes_owned: Vec<String> = excludes_fs.iter().map(|s| s.to_string()).collect();
        for_each_rs_file(&scan_root, excludes_owned, gitignore.clone(), &mut visit);
    }

    let cc_total = cc_decisions + 1;
    let cc_density = if rust_code > 0 {
        (cc_total as f64) / (rust_code as f64)
    } else {
        0.0
    };
    let abc_mag = ((abc_a * abc_a + abc_b * abc_b + abc_c * abc_c) as f64).sqrt();
    let n1 = halstead_ops_unique.len();
    let n2 = halstead_operands_unique.len();
    let n = n1 + n2;
    let n_big = halstead_ops_total + halstead_operands_total;
    let h_volume = if n > 0 {
        (n_big as f64) * ((n as f64).log2())
    } else {
        0.0
    };
    let h_difficulty = if n2 > 0 {
        (n1 as f64 / 2.0) * (halstead_operands_total as f64 / n2 as f64)
    } else {
        0.0
    };
    let h_effort = h_difficulty * h_volume;
    let comment_density = if rust_lines > 0 {
        (rust_comments as f64) * 100.0 / (rust_lines as f64)
    } else {
        0.0
    };
    let mi = if mi_count > 0 {
        mi_sum / (mi_count as f64)
    } else {
        0.0
    };

    // Calculate metrics paths
    let metrics_dir = {
        let cand = std::path::Path::new(&metrics_rel);
        if cand.is_absolute() {
            cand.to_path_buf()
        } else {
            scan_root.join(&metrics_rel)
        }
    };
    if !metrics_dir.exists() {
        let _ = fs::create_dir_all(&metrics_dir);
    }

    let tree = build_tree(&scan_root, &scan_root, gitignore.clone());

    // Paths to write
    let json_path_web = project_root.join("apps/web/public/ryoiki.cc.json");
    let json_path_metrics = metrics_dir.join("ryoiki.cc.json");

    let json = serde_json::to_string_pretty(&tree).unwrap_or_else(|_| "{}".to_string());

    // Write files
    fs::write(&json_path_web, &json).ok();
    fs::write(&json_path_metrics, &json).ok();

    // Generate metrics summary
    let mut root = serde_json::Map::new();
    let mut totals = serde_json::Map::new();
    totals.insert(
        "files".to_string(),
        serde_json::Value::Number(serde_json::Number::from(total_files as u64)),
    );
    totals.insert(
        "lines".to_string(),
        serde_json::Value::Number(serde_json::Number::from(total_lines as u64)),
    );
    totals.insert(
        "code".to_string(),
        serde_json::Value::Number(serde_json::Number::from(total_code as u64)),
    );
    totals.insert(
        "comments".to_string(),
        serde_json::Value::Number(serde_json::Number::from(total_comments as u64)),
    );
    root.insert("totals".to_string(), serde_json::Value::Object(totals));
    let mut advanced = serde_json::Map::new();
    advanced.insert(
        "comment_density_pct".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(comment_density)
                .unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    advanced.insert(
        "cyclomatic_total".to_string(),
        serde_json::Value::Number(serde_json::Number::from(cc_total as u64)),
    );
    advanced.insert(
        "cyclomatic_density".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(cc_density).unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    let mut abc = serde_json::Map::new();
    abc.insert(
        "a".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(abc_a as f64)
                .unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    abc.insert(
        "b".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(abc_b as f64)
                .unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    abc.insert(
        "c".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(abc_c as f64)
                .unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    abc.insert(
        "magnitude".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(abc_mag).unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    advanced.insert("abc".to_string(), serde_json::Value::Object(abc));
    let mut hal = serde_json::Map::new();
    hal.insert(
        "n1_ops_unique".to_string(),
        serde_json::Value::Number(serde_json::Number::from(n1 as u64)),
    );
    hal.insert(
        "n2_operands_unique".to_string(),
        serde_json::Value::Number(serde_json::Number::from(n2 as u64)),
    );
    hal.insert(
        "ops_total".to_string(),
        serde_json::Value::Number(serde_json::Number::from(halstead_ops_total as u64)),
    );
    hal.insert(
        "operands_total".to_string(),
        serde_json::Value::Number(serde_json::Number::from(halstead_operands_total as u64)),
    );
    hal.insert(
        "volume".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(h_volume).unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    hal.insert(
        "difficulty".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(h_difficulty)
                .unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    hal.insert(
        "effort".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(h_effort).unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    advanced.insert("halstead".to_string(), serde_json::Value::Object(hal));
    advanced.insert(
        "maintainability_index".to_string(),
        serde_json::Value::Number(
            serde_json::Number::from_f64(mi).unwrap_or_else(|| serde_json::Number::from(0)),
        ),
    );
    root.insert("advanced".to_string(), serde_json::Value::Object(advanced));
    let metrics_summary = serde_json::Value::Object(root);
    let metrics_json =
        serde_json::to_string_pretty(&metrics_summary).unwrap_or_else(|_| "{}".to_string());

    let metrics_json_path = metrics_dir.join("ryoiki.metrics.json");
    fs::write(&metrics_json_path, &metrics_json).ok();
    let metrics_json_web = project_root.join("apps/web/public/ryoiki.metrics.json");
    fs::write(&metrics_json_web, &metrics_json).ok();

    Ok(json)
}

fn classify(name: &str) -> &'static str {
    match name {
        "Rust" | "C" | "C++" | "C#" | "Go" | "Zig" | "Swift" | "Objective-C" | "Objective-C++" => {
            "Systems"
        }
        "Python" | "Ruby" | "Perl" | "Lua" | "Shell" | "Bash" | "PowerShell" | "Fish" => {
            "Scripting"
        }
        "JavaScript" | "TypeScript" | "JSX" | "TSX" | "Vue" | "Svelte" | "HTML" | "CSS"
        | "Less" | "Sass" | "SCSS" => "Web",
        "JSON" | "YAML" | "TOML" | "XML" | "EDN" | "RON" => "Config",
        "Markdown" | "reStructuredText" | "Org" => "Docs",
        "Makefile" | "CMake" | "Ninja" => "Build",
        "SQL" | "Protobuf" | "GraphQL" => "Data",
        _ => "Other",
    }
}

const EXCLUDES: &[&str] = &[
    "target",
    "node_modules",
    "dist",
    "build",
    "npm_modules",
    ".git",
    "ryoiki.cc.json",
    "ryoiki.metrics.json",
    "package-lock.json",
];

fn is_excluded_list<S: AsRef<str>>(excludes: &[S], path: &Path, gi: Option<&Gitignore>) -> bool {
    if path.components().any(|c| {
        let s = c.as_os_str().to_string_lossy();
        excludes.iter().any(|e| s == e.as_ref())
    }) {
        return true;
    }
    if let Some(g) = gi {
        let m = g.matched_path_or_any_parents(path, path.is_dir());
        if m.is_ignore() {
            return true;
        }
    }
    false
}

fn for_each_rs_file(
    dir: &Path,
    excludes: Vec<String>,
    gi: Option<Arc<Gitignore>>,
    cb: &mut dyn FnMut(&Path),
) {
    let mut walker = WalkBuilder::new(dir);
    walker.git_ignore(true).git_global(true).git_exclude(true);
    let excludes_captured = excludes.clone();
    let gi_captured = gi.clone();
    walker.filter_entry(move |e| {
        let p = e.path();
        let gi_ref = gi_captured.as_ref().map(|a| a.as_ref());
        !is_excluded_list(&excludes_captured, p, gi_ref)
    });
    for entry in walker.build().flatten() {
        let p = entry.path();
        if p.is_file() && p.extension().and_then(|s| s.to_str()) == Some("rs") {
            cb(p);
        }
    }
}

fn build_tree(
    dir: &std::path::Path,
    project_root: &std::path::Path,
    gi: Option<Arc<Gitignore>>,
) -> Node {
    let mut children: Vec<Node> = Vec::new();
    let mut total_loc = 0usize;
    let mut total_complexity = 0usize;
    let mut total_functions = 0usize;
    let mut langs: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    let mut entries: Vec<std::path::PathBuf> = Vec::new();
    let mut walker = WalkBuilder::new(dir);
    walker
        .max_depth(Some(1))
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true);
    let dir_owned = dir.to_path_buf();
    let gi_captured = gi.clone();
    walker.filter_entry(move |e| {
        let p = e.path();
        if p == dir_owned.as_path() {
            return true;
        }
        let gi_ref = gi_captured.as_ref().map(|a| a.as_ref());
        !is_excluded_list(EXCLUDES, p, gi_ref)
    });
    for entry in walker.build().flatten() {
        let p = entry.path();
        if p != dir {
            entries.push(p.to_path_buf());
        }
    }
    entries.sort();

    for entry in entries {
        let p = entry.clone();
        let gi_ref = gi.as_ref().map(|a| a.as_ref());
        if is_excluded_list(EXCLUDES, &p, gi_ref) {
            continue;
        }
        if p.is_dir() {
            let child = build_tree(&p, project_root, gi.clone());
            total_loc += child.metrics.loc;
            total_complexity += child.metrics.complexity;
            total_functions += child.metrics.functions;
            if let Some(l) = &child.language {
                *langs.entry(l.clone()).or_default() += child.metrics.loc;
            }
            children.push(child);
        } else if p.is_file()
            && let Some((node, lang)) = build_file_node(&p, project_root)
        {
            total_loc += node.metrics.loc;
            total_complexity += node.metrics.complexity;
            total_functions += node.metrics.functions;
            if let Some(l) = lang {
                *langs.entry(l.clone()).or_default() += node.metrics.loc;
            }
            children.push(node);
        }
    }

    let language = dominant_language(&langs);
    let is_root = dir == project_root;
    let rel = dir.strip_prefix(project_root).unwrap_or(dir);
    let path_str = if is_root {
        ".".to_string()
    } else {
        rel.to_string_lossy().to_string()
    };
    let name = if is_root {
        project_root
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    } else {
        dir.file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path_str.clone())
    };
    Node {
        name,
        path: path_str,
        kind: "directory".to_string(),
        metrics: Metrics {
            loc: total_loc,
            complexity: total_complexity,
            functions: total_functions,
        },
        language,
        children: Some(children),
    }
}

fn build_file_node(
    p: &std::path::Path,
    project_root: &std::path::Path,
) -> Option<(Node, Option<String>)> {
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let lang = match ext.as_str() {
        "rs" => Some("rust".to_string()),
        "ts" | "tsx" => Some("typescript".to_string()),
        "js" | "jsx" | "mjs" | "cjs" => Some("javascript".to_string()),
        "json" => Some("json".to_string()),
        "toml" => Some("toml".to_string()),
        "md" | "markdown" => Some("markdown".to_string()),
        "py" | "pyw" => Some("python".to_string()),
        "java" => Some("java".to_string()),
        "go" => Some("go".to_string()),
        "cpp" | "cxx" | "cc" | "hpp" | "hxx" => Some("cpp".to_string()),
        "c" | "h" => Some("c".to_string()),
        "cs" => Some("csharp".to_string()),
        "php" => Some("php".to_string()),
        "rb" => Some("ruby".to_string()),
        "kt" | "kts" => Some("kotlin".to_string()),
        "swift" => Some("swift".to_string()),
        "scala" | "sc" => Some("scala".to_string()),
        "sh" | "bash" | "zsh" => Some("shell".to_string()),
        "ps1" | "psm1" | "psd1" => Some("powershell".to_string()),
        "html" | "htm" => Some("html".to_string()),
        "css" | "scss" | "sass" | "less" => Some("css".to_string()),
        "yaml" | "yml" => Some("yaml".to_string()),
        "xml" => Some("xml".to_string()),
        "svelte" => Some("svelte".to_string()),
        "sql" => Some("sql".to_string()),
        "dockerfile" => Some("docker".to_string()),
        _ => None,
    };
    let txt = fs::read_to_string(p).ok()?;
    let loc = txt.lines().count();
    let s = sanitize(&txt);
    let complexity = match lang.as_deref() {
        Some("rust") => count_cyclomatic_decisions(&s) + 1,
        Some("typescript") | Some("javascript") | Some("java") | Some("cpp") | Some("c")
        | Some("csharp") | Some("php") | Some("kotlin") | Some("swift") | Some("scala")
        | Some("go") => count_conditionals_js_like(&s) + 1,
        Some("python") => count_conditionals_python(&s) + 1,
        _ => 0,
    };
    let functions = match lang.as_deref() {
        Some("rust") => count_token(&s, "fn "),
        Some("typescript") | Some("javascript") => {
            count_token(&s, "function ") + count_token(&s, "=>")
        }
        Some("python") => count_token(&s, "def "),
        Some("go") => count_token(&s, "func "),
        Some("java") | Some("csharp") | Some("cpp") | Some("c") | Some("kotlin")
        | Some("swift") | Some("scala") | Some("php") => {
            // Rough heuristic for C-like languages: count generic block openings that look like function defs?
            // Actually, simply counting "{" might be too much.
            // For now, let's just stick to 0 or simple keywords if possible.
            // Improving this would require more robust parsing.
            0
        }
        _ => 0,
    };
    let rel = p.strip_prefix(project_root).unwrap_or(p);
    let path_str = rel.to_string_lossy().to_string();
    let name = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.clone());
    let node = Node {
        name,
        path: path_str,
        kind: "file".to_string(),
        metrics: Metrics {
            loc,
            complexity,
            functions,
        },
        language: lang.clone(),
        children: None,
    };
    Some((node, lang))
}

fn dominant_language(map: &std::collections::HashMap<String, usize>) -> Option<String> {
    let mut v: Vec<(&String, &usize)> = map.iter().collect();
    v.sort_by(|a, b| b.1.cmp(a.1));
    v.first().map(|(k, _)| (*k).clone())
}

fn count_conditionals_js_like(s: &str) -> usize {
    count_token(s, "if")
        + count_token(s, "switch")
        + count_token(s, "case")
        + count_token(s, "&&")
        + count_token(s, "||")
        + count_token(s, "for")
        + count_token(s, "while")
}

fn count_conditionals_python(s: &str) -> usize {
    count_token(s, "if ")
        + count_token(s, "elif ")
        + count_token(s, "for ")
        + count_token(s, "while ")
        + count_token(s, "except ")
        + count_token(s, " and ")
        + count_token(s, " or ")
}
