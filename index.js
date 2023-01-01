const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());



// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.twtll.mongodb.net/?retryWrites=true&w=majority`;
// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const uri = "mongodb+srv://resale-admin:FN27FNd6IV0TbVMd@cluster0.jmggglu.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];
    console.log(token, "token")
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}
function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];
    console.log(token, "token ")
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        const categoryCollection = client.db('resale-market-node').collection('category');
        const productCollection = client.db('resale-market-node').collection('product');
        const usersCollection = client.db('resale-market-node').collection('users');
        const ordersCollection = client.db('resale-market-node').collection('orders');
        // const bookingsCollection = client.db('doctorsPortal').collection('bookings');
        // const usersCollection = client.db('doctorsPortal').collection('users');
        // const doctorsCollection = client.db('doctorsPortal').collection('doctors');
        // const paymentsCollection = client.db('doctorsPortal').collection('payments');

        // NOTE: make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            req.userinfo = user
            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }
        const verifyBuyer = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            req.userinfo = user
            if (user?.role !== 'buyer') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }






        /***
         * API Naming Convention 
         * app.get('/bookings')
         * app.get('/bookings/:id')
         * app.post('/bookings')
         * app.patch('/bookings/:id')
         * app.delete('/bookings/:id')
        */



        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            // TODO: make sure you do not enter duplicate user email
            // only insert users if the user doesn't exist in the database
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        app.post('/orders', verifyJWT, verifyBuyer, async (req, res) => {
            const order = { ...req.body, user: req.userinfo._id };
            // console.log(order);
            const product = await productCollection.findOne({ _id: ObjectId(req.body.product) });
            if (product.payment == "paid") {
                return res.status(403).send({ message: 'Already purchedsed this item' })
            } else {
                if (product) {
                    const filter = { _id: ObjectId(req.body.product) }
                    const updatedDoc = {
                        $set: {
                            payment: "paid",

                        }
                    }
                    const updatedResult = await productCollection.updateOne(filter, updatedDoc)

                    const result = await ordersCollection.insertOne({ ...order, owner: product.user });
                    console.log(product.user, "product.user")
                    res.send(result);
                } else {
                    return res.status(403).send({ message: 'forbidden access' })
                }
            }
            // console.log(req.body.product, product)

            // TODO: make sure you do not enter duplicate order email
            // only insert orders if the order doesn't exist in the database
        });
        app.get('/myorders', async (req, res) => {

            // TODO: make sure you do not enter duplicate order email
            // only insert orders if the order doesn't exist in the database
            const result = await ordersCollection.find({}).toArray();

            // const result = await ordersCollection.findOne({}).toArray();
            res.send(result);
        });



        app.post('/jwt', async (req, res) => {
            const email = req.body.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            console.log(email, user);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token, user });
            }
            else {

                res.status(403).send({ accessToken: '' })
            }
        });

        app.get('/verifyuser', verifyJWT, async (req, res) => {

            const email = req.decoded?.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            console.log(email, user);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token, user });
            }
            else {

                res.status(403).send({ accessToken: '' })
            }
        })
        app.get('/singleuserOrder', verifyJWT, async (req, res) => {

            const email = req.decoded?.email;
            const query = { email: email };


            const user = await usersCollection.findOne(query);
            console.log('user', user)
            const result = await ordersCollection.find({ user: ObjectId(user._id) }).toArray();
            res.send(result);
        })

        app.get('/category', async (req, res) => {


            const result = await categoryCollection.find({}).toArray();
            res.send(result);
        });
        app.post('/category', async (req, res) => {
            const category = req.body;
            const slug = category.name.toLowerCase();


            const result = await categoryCollection.insertOne({ ...category, slug });
            res.send(result);
        });
        app.post('/products', verifyJWT, verifySeller, async (req, res) => {
            let product = { ...req.body, user: req.userinfo._id };




            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        app.get('/products', async (req, res) => {


            const result = await productCollection.find({}).toArray();
            res.send(result);
        });
        app.get('/products/:id', async (req, res) => {


            const result = await productCollection.find({ category: req.params.id }).toArray();
            res.send(result);
        });
        app.get('/singleproduct/:id', async (req, res) => {

            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.findOne(query);
            // const result = await productCollection.find({ _id: req.params.id }).toArray();
            res.send(result);
        });
        app.get('/myproducts', verifyJWT, verifySeller, async (req, res) => {
            // req.userinfo._id 
            const query = { user: req.userinfo._id };
            console.log(req.userinfo._id)

            const result = await productCollection.find(query).toArray();
            res.send(result);
        });
        app.get('/mybuyers', verifyJWT, verifySeller, async (req, res) => {
            // req.userinfo._id 
            const query = { owner: req.userinfo._id };
            console.log(req.userinfo._id)

            const result = await ordersCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/allusers', verifyJWT, verifyAdmin, async (req, res) => {
            // req.userinfo._id 


            const result = await usersCollection.find({}).toArray();
            res.send(result);
        });

        // app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) }
        //     const options = { upsert: true };
        //     const updatedDoc = {
        //         $set: {
        //             role: 'admin'
        //         }
        //     }
        //     const result = await usersCollection.updateOne(filter, updatedDoc, options);
        //     res.send(result);
        // });




        // app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const result = await doctorsCollection.deleteOne(filter);
        //     res.send(result);
        // })

    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('Resale Market is runinng');
})

app.listen(port, () => console.log(`Resale Market is runinng on ${port}`))