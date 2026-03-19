;; Java import resolution nodes
;; Captures the package/class name for LSP resolution

; import java.util.List;
(import_declaration
  (scoped_identifier) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (public/private/protected/package-private)
;; TODO: Add queries for ast-x:isStatic (static methods, fields, nested classes)
;; TODO: Add queries for ast-x:isOptional (parameters with default values, e.g., Optional<T>)
