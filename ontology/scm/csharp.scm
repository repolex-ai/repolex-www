;; C# import resolution nodes
;; Captures the namespace name for LSP resolution

; using System.Collections.Generic;
(using_directive
  (qualified_name) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (public/private/protected/internal)
;; TODO: Add queries for ast-x:isStatic (static class members)
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
