/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// App-wide typed locals injected by src/middleware.ts.
declare namespace App {
  interface Locals {
    /** True when the request carries a valid admin session cookie. */
    auth?: boolean;
  }
}