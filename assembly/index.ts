// The entry file of your WebAssembly module.

export function add(a: i32, b: i32): i32 {
  return a + b;
}

interface employee {
  l: string;
  f: string;
  d: string;
  j: string;
  b: f32;
  ov: f32;
  h: f32;
  r: f32;
  ot: f32;
  [key:string]: any;
}

type employeeOptionsFullNumbB = "b"
type employeeOptionsFullNumbH = "h"

export function sortEmployeesByKey(arrayOfObjects:Array<employee>,keyname: string,reverse:boolean):Array<employee> {

  if (keyname === "b") {
    return arrayOfObjects.sort((a:employee,b:employee) => {
      if (reverse == false) {
        return a["b"]-b["b"];
      } else {
        return b["b"]-a["b"];
      }
    });
  }

 if (keyname === "j") {
  return arrayOfObjects.sort((a:employee,b:employee) => {
    var stateOfBoolean:boolean;
    
    if (a["f"] == b["f"]) {
      return 0;
    } else {
      if (reverse === false) {
         if (a["f"] > b["f"]) {
          return 1;
         } else {
          return -1;
         }
      } else {
        if (b["f"] > a["f"]) {
          return 1;
         } else {
           return -1;
         }
      }
    }

   
    
  });
 }
}