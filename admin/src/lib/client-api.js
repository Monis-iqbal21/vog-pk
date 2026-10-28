'use client';
export async function adminMutation(path,body={},method='POST'){
 const challenge=await fetch('/api/auth/csrf',{cache:'no-store'});
 if(!challenge.ok)throw new Error('Request verification failed. Reload the page.');
 const {csrfToken}=await challenge.json();
 const response=await fetch('/api/admin/'+path,{method,headers:{'Content-Type':'application/json','x-csrf-token':csrfToken},body:JSON.stringify(body)});
 const data=await response.json();
 if(response.status===401&&path!=='auth/login')window.dispatchEvent(new Event('vog:session-expired'));
 if(!response.ok)throw new Error(data.message??'The request could not be completed.');
 return data;
}
