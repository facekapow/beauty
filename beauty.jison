%lex

%%

\b[0-9]+("."[0-9]+)?\b {return 'NUMBER';}
\b(?:func)\b {return 'FUNC';}
\b(?:class)\b {return 'CLASS';}
\b(?:return)\b {return 'RETURN';}
\b(?:if|when)\b {return 'IF';}
\b(?:unless)\b {return 'UNLESS';}
\b(?:else|otherwise)\b {return 'ELSE';}
\b(?:for)\b {return 'FOR';}
\b(?:each|every)\b {return 'EACH';}
\b(?:of)\b {return 'OF';}
\b(?:within)\b {return 'IN';}
\b(?:while)\b {return 'WHILE';}
\b(?:until)\b {return 'UNTIL';}
\b(?:null|nothing)\b {return 'NULL';}
\b(?:true|yes|on|correct|right)\b {return 'TRUE';}
\b(?:false|no|off|incorrect|wrong)\b {return 'FALSE';}
\b(?:and)\b {return 'AND';}
\b(?:or)\b {return 'OR';}
\b(?:is|equals)\b {return 'EQUALS';}
\b(?:isnt)\b {return 'NOTEQUALS';}
\b(?:not)\b {return 'NOT';}
\b(?:new|create)\b {return 'NEW';}
\b(?:from)\b {return 'FROM';}
\b(?:to)\b {return 'TO';}
\b(?:throw)\b {return 'THROW';}
\b(?:try)\b {return 'TRY';}
\b(?:catch)\b {return 'CATCH';}
[a-zA-Z_$?@~]+([0-9]+)? {return 'IDENTIFIER';}
\"(?:[^"\\]|\\.)*\" {return 'STRING';}
\n+ {return 'NEWLINE';}
"#".* {/* ignore comments */}
\s+ {/* ignore whitespace */}
\t+ {/* ignore tabs */}
"*" {return '*';}
"/" {return '/';}
"+" {return '+';}
"-" {return '-';}
"^" {return '^';}
"%" {return '%';}
"(" {return '(';}
")" {return ')';}
"{" {return '{';}
"}" {return '}';}
"[" {return '[';}
"]" {return ']';}
"," {return ',';}
";" {return ';';}
":" {return ':';}
"." {return '.';}
"=" {return '=';}
"&" {return '&';}
"|" {return '|';}
"!" {return '!';}
<<EOF>> {return 'EOF';}

/lex

%left '+' '-'
%left '*' '/'
%left '^'
%left '%'
%left UMINUS
%left UNOT

%start program

%%

program
  : statements EOF
    {
      var ret = $1;
      if ($1.toVal) ret = $1.toVal(yy.globalScope);
      return ret;
    }
  | EOF
    {return null;}
  ;

statements
  : statement
    {
      if ($1) {
        $$ = new yy.Statements();
        $$.push($1);
      }
    }
  | statements NEWLINE statement
    {
      if ($3) $1.push($3);
      yy.currentLine();
    }
  | statements ';' statement
    {if ($3) $1.push($3);}
  | statements NEWLINE
    {
      $$ = $1;
      yy.currentLine();
    }
  | statements ';'
    {$$ = $1;}
  | NEWLINE statements
    {
      $$ = $2;
      yy.currentLine();
    }
  | ';' statements
    {$$ = $2;}
  ;

statement
  : expr
  | varDecl
  | assignment
  | block
  | funcDecl
  | retStmt
  | ifStmt
  | unlessStmt
  | forStmt
  | whileStmt
  | untilStmt
  | classStatement
  | varOp
  | throwStmt
  | tryStmt
  ;

classStmts
  : classStmt
    {
      if ($1) {
        $$ = new yy.ClassStatements();
        $$.push($1);
      }
    }
  | classStmts NEWLINE classStmt
    {
      if ($3) $1.push($3);
      yy.currentLine();
    }
  | classStmts ';' classStmt
    {if ($3) $1.push($3);}
  | classStmts NEWLINE
    {
      $$ = $1;
      yy.currentLine();
    }
  | classStmts ';'
    {$$ = $1;}
  | NEWLINE classStmts
    {
      $$ = $2;
      yy.currentLine();
    }
  | ';' classStmts
    {$$ = $2;}
  ;

classStmt
  : expr
  | classVarDecl
  | classAssignment
  | classFuncDecl
  ;

classVarDecl
  : id id '=' expr
    {
      $$ = new yy.ClassVariable($2, $1);
      $$.setVal($4);
    }
  ;

classAssignment
  : id '=' expr
    {$$ = new yy.ClassAssignment($1, $3);}
  ;

classFuncDecl
  : FUNC id '(' funcDeclParams ')' block
    {$$ = new yy.ClassFunction($2, $4, $6);}
  ;

classBlock
  : '{' classStmts '}'
    {$$ = new yy.ClassBlock($2);}
  ;

classStatement
  : CLASS id classBlock
    {$$ = new yy.Class($2, $3);}
  ;

throwStmt
  : THROW expr
    {$$ = new yy.Throw($2);}
  ;

tryStmt
  : TRY block
    {$$ = new yy.Try($2);}
  | TRY block CATCH id block
    {$$ = new yy.Try($2, $4, $5);}
  ;

unlessStmt
  : UNLESS expr block
    {$$ = new yy.Unless($2, $3);}
  | UNLESS expr block ELSE block
    {$$ = new yy.Unless($2, $3, $5);}
  ;

ifStmt
  : IF expr block
    {$$ = new yy.If($2, $3);}
  | IF expr block ELSE block
    {$$ = new yy.If($2, $3, $5);}
  ;

forStmt
  : FOR EACH id OF expr block
    {$$ = new yy.For(0, $3, $5, $6);}
  | FOR EACH id IN expr block
    {$$ = new yy.For(1, $3, $5, $6);}
  ;

whileStmt
  : WHILE expr block
    {$$ = new yy.While($2, $3);}
  ;

untilStmt
  : UNTIL expr block
    {$$ = new yy.Until($2, $3);}
  ;

retStmt
  : RETURN expr
    {$$ = new yy.Return($2);}
  ;

funcDeclParams
  : /* empty */
    {$$ = [];}
  | id
    {$$ = [$1];}
  | funcDeclParams ',' id
    {$1.push($3);}
  ;

funcCallArgs
  : /* empty */
    {$$ = [];}
  | expr
    {$$ = [$1];}
  | funcCallArgs ',' expr
    {$1.push($3);}
  ;

funcDecl
  : FUNC id '(' funcDeclParams ')' block
    {$$ = new yy.BFunction($2, $4, $6);}
  ;

funcExpr
  : FUNC '(' funcDeclParams ')' block
    {$$ = new yy.BFunction(null, $3, $5);}
  ;

funcCall
  : expr '(' funcCallArgs ')'
    {$$ = new yy.FunctionCall($1, $3);}
  ;

block
  : '{' statements '}'
    {$$ = new yy.Block($2);}
  | statement
    {$$ = new yy.Block($1);}
  ;

num
  : NUMBER
    {$$ = new yy.BNumber($1);}
  ;

operation
  : expr '+' expr
    {$$ = new yy.Operation(0, $1, $3);}
  | expr '-' expr
    {$$ = new yy.Operation(1, $1, $3);}
  | expr '*' expr
    {$$ = new yy.Operation(2, $1, $3);}
  | expr '/' expr
    {$$ = new yy.Operation(3, $1, $3);}
  | expr '^' expr
    {$$ = new yy.Operation(4, $1, $3);}
  | expr '%' expr
    {$$ = new yy.Operation(5, $1, $3);}
  | '-' expr %prec UMINUS
    {$$ = new yy.Operation(6, $2);}
  | expr '=' '=' expr
    {$$ = new yy.Operation(7, $1, $4);}
  | expr EQUALS expr
    {$$ = new yy.Operation(7, $1, $3);}
  | expr '&' '&' expr
    {$$ = new yy.Operation(8, $1, $4);}
  | expr AND expr
    {$$ = new yy.Operation(8, $1, $3);}
  | expr '|' '|' expr
    {$$ = new yy.Operation(9, $1, $4);}
  | expr OR expr
    {$$ = new yy.Operation(9, $1, $3);}
  | expr NOTEQUALS expr
    {$$ = new yy.Operation(10, $1, $3);}
  | expr '!' '=' expr
    {$$ = new yy.Operation(10, $1, $4);}
  ;

id
  : IDENTIFIER
    {$$ = new yy.Identifier($1);}
  ;

varDecl
  : id id
    {$$ = new yy.Variable($2, $1);}
  | id id '=' expr
    {$$ = new yy.Variable($2, $1, null, $4);}
  ;

assignment
  : id '=' expr
    {$$ = new yy.Assignment($1, $3);}
  | accessor '=' expr
    {$$ = new yy.Assignment($1, $3, true);}
  ;

string
  : STRING
    {
      $$ = new yy.BString($1.substr(1, $1.length-2).replace(/\\(.)/g, (m, cap1) => eval('\'\\' + cap1 + '\'')));
    }
  ;

nullValue
  : NULL
    {$$ = new yy.NullValue();}
  ;

array
  : /* empty */
    {$$ = new yy.BArray();}
  | expr
    {
      $$ = new yy.BArray();
      $$.add($1);
    }
  | array ',' expr
    {$1.add($3);}
  | NEWLINE array
    {$$ = $2;}
  | array NEWLINE
    {$$ = $1;}
  ;

object
  : /* empty */
    {$$ = new yy.BObject();}
  | id ':' expr
    {
      $$ = new yy.BObject();
      $$.add($1, $3);
    }
  | object ',' id ':' expr
    {$1.add($3, $5);}
  | object ',' NEWLINE id ':' expr
    {$1.add($4, $6);}
  | NEWLINE object
    {$$ = $2;}
  | object NEWLINE
    {$$ = $1;}
  ;

accessor
  : expr '.' id
    {$$ = new yy.Accessor($1, $3);}
  | expr '[' expr ']'
    {$$ = new yy.Accessor($1, $3, true);}
  ;

bool
  : TRUE
    {$$ = new yy.BBoolean(true);}
  | FALSE
    {$$ = new yy.BBoolean(false);}
  ;

newExpr
  : NEW expr
    {$$ = new yy.New($2);}
  ;

range
  : FROM expr TO expr
    {$$ = new yy.Range($2, $4, true);}
  | expr '.' '.' '.' expr
    {$$ = new yy.Range($1, $5, true);}
  | expr '.' '.' expr
    {$$ = new yy.Range($1, $4);}
  | expr TO expr
    {$$ = new yy.Range($1, $3);}
  ;

varOp
  : expr '+' '=' expr
    {$$ = new yy.VarOperation(0, $1, $4);}
  | expr '-' '=' expr
    {$$ = new yy.VarOperation(1, $1, $4);}
  | expr '+' '+'
    {$$ = new yy.VarOperation(2, $1);}
  | expr '-' '-'
    {$$ = new yy.VarOperation(3, $1);}
  ;

expr
  : num
  | id
  | operation
  | funcCall
  | funcExpr
  | string
  | nullValue
  | accessor
  | bool
  | newExpr
  | '(' expr ')'
    {$$ = $2;}
  | '[' array ']'
    {$$ = $2;}
  | '{' object '}'
    {$$ = $2;}
  | range
  ;
