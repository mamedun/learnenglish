<?php
declare(strict_types=1);
function init_env():void{$file=(getenv('ENV_FILE')?:dirname(__DIR__).'/.env');if(!is_file($file))return;foreach(file($file,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $line){$line=trim($line);if($line===''||str_starts_with($line,'#')||!str_contains($line,'='))continue;[$key,$value]=explode('=',$line,2);$key=trim($key);$value=trim($value);if(strlen($value)>1&&(($value[0]==='"'&&substr($value,-1)==='"')||($value[0]==="'"&&substr($value,-1)==="'")))$value=substr($value,1,-1);if(getenv($key)===false){putenv($key.'='.$value);$_ENV[$key]=$value;}}}
function envv(string $key,string $default=''):string{$v=getenv($key);return $v===false?$default:trim((string)$v);}
