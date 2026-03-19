;; TypeScript import resolution nodes
;; Captures the module path for LSP resolution

; import { foo } from "bar";
; import React from "react";
(import_statement
  source: (string) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (public/private/protected)
;; TODO: Add queries for ast-x:isStatic (static class members)
;; TODO: Add queries for ast-x:isOptional (optional parameters: param?: Type or param = defaultValue)
