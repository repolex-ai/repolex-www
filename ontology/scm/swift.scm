;; Swift import resolution nodes
;; Captures the module name for LSP resolution

; import Foundation
; import UIKit
(import_declaration
  (identifier) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (Swift uses visibility_modifier: public, private, internal, fileprivate, open)
;; TODO: Add queries for ast-x:isStatic (Swift uses member_modifier with "static" or "class")
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
