;; Go import resolution nodes
;; Captures the import package path for LSP resolution

; import "fmt"
; import (
;     "os"
;     "path"
; )
(import_declaration
  (import_spec) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (uppercase = exported, lowercase = private)
;; TODO: Add queries for ast-x:isStatic (Go has no classes, all package-level functions)
;; TODO: Add queries for ast-x:isOptional (Go has no default params, use variadic or options pattern)
