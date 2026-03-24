;; Scala import resolution nodes
;; Captures the import path for LSP resolution

; import scala.collection.mutable
; import org.scalatest._
(import_declaration
  (stable_identifier) @scm.resolution_node)

;; ast-x:ExtendsClause — Scala has a dedicated extends_clause node
;; class Foo extends Bar with Baz
(extends_clause) @scm.extends_clause

;; TODO: Add queries for ast-x:visibility (Scala uses access_modifier: private, protected, private[scope])
;; TODO: Add queries for ast-x:isStatic (Scala objects are singletons, not really "static")
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
