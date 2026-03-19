;; C++ import resolution nodes
;; Captures the header path for LSP resolution

; #include <iostream>
; #include "myheader.h"
(preproc_include
  path: (string_literal) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (public/private/protected in class context)
;; TODO: Add queries for ast-x:isStatic (static member functions/variables)
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
