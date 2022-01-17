
export function uploadfiles (req,res){

    console.log(` request object is ${req}, response object is ${res} `);
    res.end({
     "success": true   
    })
}