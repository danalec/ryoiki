use std::collections::HashSet;

pub fn sanitize(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    let mut chars = src.chars().peekable();
    let mut in_line = false;
    let mut in_block = false;
    let mut in_str = false;
    let mut in_char = false;
    let mut esc = false;
    while let Some(ch) = chars.next() {
        if in_line {
            if ch == '\n' {
                in_line = false;
                out.push('\n');
            }
            continue;
        }
        if in_block {
            if ch == '*'
                && let Some('/') = chars.peek().copied()
            {
                chars.next();
                in_block = false;
            }
            continue;
        }
        if in_str {
            if esc {
                esc = false;
            } else if ch == '\\' {
                esc = true;
            } else if ch == '"' {
                in_str = false;
            }
            continue;
        }
        if in_char {
            if esc {
                esc = false;
            } else if ch == '\\' {
                esc = true;
            } else if ch == '\'' {
                in_char = false;
            }
            continue;
        }
        if ch == '/' {
            match chars.peek().copied() {
                Some('/') => {
                    chars.next();
                    in_line = true;
                    continue;
                }
                Some('*') => {
                    chars.next();
                    in_block = true;
                    continue;
                }
                _ => {}
            }
        }
        if ch == '"' {
            in_str = true;
            continue;
        }
        if ch == '\'' {
            in_char = true;
            continue;
        }
        out.push(ch);
    }
    out
}

pub fn count_token(s: &str, token: &str) -> usize {
    let mut count = 0;
    let mut i = 0;
    while let Some(pos) = s[i..].find(token) {
        count += 1;
        i += pos + token.len();
    }
    count
}

pub fn count_assignments(s: &str) -> usize {
    let mut c = 0usize;
    let bytes = s.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'=' {
            let prev = if i > 0 { bytes[i - 1] } else { b'\0' };
            let next = if i + 1 < bytes.len() {
                bytes[i + 1]
            } else {
                b'\0'
            };
            if prev != b'!'
                && prev != b'<'
                && prev != b'>'
                && prev != b'='
                && next != b'='
                && next != b'>'
            {
                c += 1;
            }
            i += 1;
            continue;
        }
        match b {
            b'+' | b'-' | b'*' | b'/' | b'%' | b'&' | b'|' | b'^' => {
                if i + 1 < bytes.len() && bytes[i + 1] == b'=' {
                    c += 1;
                    i += 2;
                    continue;
                }
            }
            _ => {}
        }
        i += 1;
    }
    c
}

pub fn count_branches(s: &str) -> usize {
    let mut c = 0usize;
    let bytes = s.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i] == b'(' {
            let mut j = i;
            if j == 0 {
                i += 1;
                continue;
            }
            j -= 1;
            while j > 0 && (bytes[j] as char).is_ascii_whitespace() {
                j -= 1;
            }
            if bytes[j] == b'!' {
                j = j.saturating_sub(1);
            }
            let mut k = j;
            while k > 0 && ((bytes[k] as char).is_ascii_alphanumeric() || bytes[k] == b'_') {
                if k == 0 {
                    break;
                }
                k -= 1;
            }
            let start = if (bytes[k] as char).is_ascii_alphanumeric() || bytes[k] == b'_' {
                k
            } else {
                k + 1
            };
            if start <= j {
                let ident = String::from_utf8_lossy(&bytes[start..=j]).to_string();
                if ident != "fn" && ident != "if" && ident != "match" && ident != "loop" {
                    c += 1;
                }
            }
        }
        i += 1;
    }
    c
}

pub fn count_conditionals(s: &str) -> usize {
    count_token(s, "if") + count_token(s, "match") + count_token(s, "&&") + count_token(s, "||")
}

pub fn count_cyclomatic_decisions(s: &str) -> usize {
    count_conditionals(s)
}

pub fn halstead_collect(s: &str) -> (usize, usize, HashSet<String>, HashSet<String>) {
    let multi = [
        "<<=", ">>=", "==", "!=", "<=", ">=", "&&", "||", "+=", "-=", "*=", "/=", "%=", "&=", "|=",
        "^=", "<<", ">>", "->", "=>", "::",
    ];
    let single: [char; 16] = [
        '+', '-', '*', '/', '%', '=', '&', '|', '^', '!', '<', '>', '.', '?', ':', '@',
    ];
    let keywords = [
        "fn", "let", "mut", "if", "else", "match", "for", "while", "loop", "return", "break",
        "continue", "struct", "enum", "impl", "trait", "use", "mod", "pub", "crate", "super",
        "Self", "self", "in", "as", "where", "const", "static", "ref", "type", "true", "false",
        "await", "async", "move", "unsafe",
    ];
    let kw: HashSet<&str> = keywords.iter().copied().collect();
    let bytes = s.as_bytes();
    let mut i = 0usize;
    let mut ops_total = 0usize;
    let mut operands_total = 0usize;
    let mut ops_set: HashSet<String> = HashSet::new();
    let mut operands_set: HashSet<String> = HashSet::new();
    while i < bytes.len() {
        let slice = &bytes[i..];
        let mut matched = false;
        for m in &multi {
            if slice.starts_with(m.as_bytes()) {
                ops_total += 1;
                ops_set.insert(m.to_string());
                i += m.len();
                matched = true;
                break;
            }
        }
        if matched {
            continue;
        }
        let ch = bytes[i] as char;
        if single.contains(&ch) {
            ops_total += 1;
            ops_set.insert(ch.to_string());
            i += 1;
            continue;
        }
        if ch.is_ascii_digit() {
            let mut j = i + 1;
            while j < bytes.len()
                && ((bytes[j] as char).is_ascii_alphanumeric()
                    || bytes[j] == b'.'
                    || bytes[j] == b'_')
            {
                j += 1;
            }
            let lit = String::from_utf8_lossy(&bytes[i..j]).to_string();
            operands_total += 1;
            operands_set.insert(lit);
            i = j;
            continue;
        }
        if ch.is_ascii_alphabetic() || ch == '_' {
            let mut j = i + 1;
            while j < bytes.len()
                && ((bytes[j] as char).is_ascii_alphanumeric() || bytes[j] == b'_')
            {
                j += 1;
            }
            let ident = String::from_utf8_lossy(&bytes[i..j]).to_string();
            if !kw.contains(ident.as_str()) {
                operands_total += 1;
                operands_set.insert(ident);
            }
            i = j;
            continue;
        }
        i += 1;
    }
    (ops_total, operands_total, ops_set, operands_set)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize() {
        let code = r#"
            // This is a comment
            let x = 1; /* Block comment */
            let s = "String // not a comment";
        "#;
        let cleaned = sanitize(code);
        assert!(!cleaned.contains("This is a comment"));
        assert!(!cleaned.contains("Block comment"));
        assert!(cleaned.contains("let x = 1;"));
        // Strings are stripped by sanitize
        assert!(!cleaned.contains("String"));
        // But the assignment structure remains (let s = ;)
        assert!(cleaned.contains("let s = ;"));
    }

    #[test]
    fn test_count_assignments() {
        let code = "a = 1; b += 2; c == 3;";
        // a = 1 (1)
        // b += 2 (1)
        // c == 3 (0)
        assert_eq!(count_assignments(code), 2);
    }

    #[test]
    fn test_count_branches() {
        let code = "fn foo() {} fn bar() {}";
        // foo() (1)
        // bar() (1)
        assert_eq!(count_branches(code), 2);
    }

    #[test]
    fn test_count_conditionals() {
        let code = "if x && y || z { match a {} }";
        // if (1)
        // && (1)
        // || (1)
        // match (1)
        assert_eq!(count_conditionals(code), 4);
    }

    #[test]
    fn test_halstead() {
        let code = "let a = b + c;";
        let (ops, operands, ops_unique, operands_unique) = halstead_collect(code);

        // Operators: = (from single), + (from single)
        // Operands: a, b, c
        // Keywords 'let' is ignored.

        assert_eq!(ops, 2); // = and +
        assert_eq!(operands, 3); // a, b, c
        assert_eq!(ops_unique.len(), 2);
        assert_eq!(operands_unique.len(), 3);
    }
}
