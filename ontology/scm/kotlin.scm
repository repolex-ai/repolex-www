;; Kotlin import resolution nodes
;; Captures the package/class name for LSP resolution

; import kotlin.collections.*
(import_header
  (identifier) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (public/private/protected/internal)
;; TODO: Add queries for ast-x:isStatic (companion object members)
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
