// Fictional Northstar entrance rates in Canadian dollars (CAD). No online payments.
export const TICKET_PRICES = Object.freeze({adult:1200,student:800,child:500});
export function ticketQuote(input){
 if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!Object.hasOwn(TICKET_PRICES,key))) throw new RangeError('Invalid ticket types.');
 const tickets={};
 for(const kind of Object.keys(TICKET_PRICES)){
  const value=input[kind]??0;
  if(!Number.isInteger(value)||value<0||value>5)throw new RangeError('Ticket quantities must be whole numbers from 0 to 5.');
  tickets[kind]=value;
 }
 const visitors=Object.values(tickets).reduce((a,b)=>a+b,0);
 if(visitors<1||visitors>5)throw new RangeError('Choose 1 to 5 tickets in total.');
 return {tickets,visitors,totalCents:Object.entries(tickets).reduce((a,[type,qty])=>a+TICKET_PRICES[type]*qty,0),currency:'CAD'};
}
