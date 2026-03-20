const db = require("../config/db");

async function splitOrder(orderId){

 const vendors = await db.query(`
   SELECT vendor_id
   FROM transaction.order_items
   WHERE order_id=$1
   GROUP BY vendor_id
 `,[orderId]);

 for(const v of vendors.rows){

   await db.query(`
     INSERT INTO transaction.order_vendor_fulfillments
     (order_id,vendor_id,fulfillment_status)
     VALUES($1,$2,'pending')
   `,[orderId,v.vendor_id]);

 }

}

module.exports = {
  splitOrder
};