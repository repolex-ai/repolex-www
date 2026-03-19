;; JavaScript import resolution nodes
;; Captures the module path for LSP resolution

; import { foo } from "bar";
; import React from "react";
(import_statement
  source: (string) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (JavaScript has no formal visibility)
;; TODO: Add queries for ast-x:isStatic (static class members)
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
