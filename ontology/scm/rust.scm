;; Rust import resolution nodes
;; Captures the module path for LSP resolution

; use std::collections::HashMap;
; use crate::parser;
(use_declaration
  argument: (scoped_identifier) @scm.resolution_node)

; use std::collections::HashMap;
(use_declaration
  argument: (identifier) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (pub, pub(crate), pub(super))
;; TODO: Add queries for ast-x:isStatic (static items in Rust)
;; TODO: Add queries for ast-x:isOptional (Rust uses Option<T>, not default params)
