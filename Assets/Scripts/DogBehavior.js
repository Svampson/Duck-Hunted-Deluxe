#pragma strict

class DogBehavior{
	var owner:TheDog;
	
	virtual function getMove()
	{
		return Vector3.zero;
	}
	
	// Check to see if we need to change states. Called prior to getMove
	virtual function checkState(){
	
	}
	
	virtual function drawGizmos(){
	
	}
}

// Spirals around the player
// Transitions to: 
//     DogPrepareToAttack -- If it senses the player
//     DogGetDuck -- If it senses a dead duck
class DogHuntPlayer extends DogBehavior{
	function getMove(){
		var diff = owner.player.transform.position - owner.transform.position;
	
		// This should give us a vector that is tangential to the player
		var move = Vector3.Normalize(Vector3.Cross(diff, Vector3.up));
		
		if (owner.isZigging){
			move *= -1;
			move = Quaternion.Euler(0,-owner.huntStrength,0) * move;	
		}
		else {
			move = Quaternion.Euler(0,owner.huntStrength,0) * move;	
		}
		
		// Make sure we don't start flying
		move.y = 0;
		move = move * owner.speed * Time.deltaTime;
		
		owner.speed += owner.huntAcceleration * Time.deltaTime;
		owner.zigTimer -= Time.deltaTime;
		
		if (owner.zigTimer < 0){
			owner.zigTimer = Random.Range(owner.minZigTime, owner.maxZigTime);
			owner.isZigging = !owner.isZigging;
		}
		
		if (owner.speed > owner.maxSpeed){
			owner.speed = owner.maxSpeed;
		}
		
		return move;
	}
	
	function checkState(){
		// Look for the player
		if (Vector3.Distance(owner.transform.position, owner.player.transform.position) < owner.playerScentRadius){
			// Only pounce if we're behind the player
			var diff = owner.transform.position - owner.player.transform.position;
			
			// Dot product of the heading of the player and the player->dog vector
			// will be negative if the dog is behind the player
			var dot:float = Vector3.Dot(diff, owner.player.transform.forward);
			
			if (dot < 0){
				owner.setBehavior(new DogPrepareToAttack());
				return;
			}
		}
		
		// Look for some dead ducks (Shhh... they're just sleeping!)
		for (var i = 0; i < DuckSpawner.ducks.length; i++){
			var duck = (DuckSpawner.ducks[i] as Transform).gameObject;
			var script = duck.GetComponent(Duck);
			if (script.isDead && Vector3.Distance(owner.transform.position, duck.transform.position) < owner.duckScentRadius){
				owner.setBehavior(new DogGetDuck(i));
				break;
			}
		}
	}
	
	function drawGizmos(){
		Gizmos.color = Color.blue;
		Gizmos.DrawWireSphere(owner.transform.position, owner.duckScentRadius);
		
		Gizmos.color = Color.yellow;
		Gizmos.DrawWireSphere(owner.transform.position, owner.playerScentRadius);
	}
}

// The dog beelines for the target duck
// Transitions:
//    DogPresentDuck -- If the dog is close to its target, present it
//    TODO: Time out or change targets if the duck is unreachable?
class DogGetDuck extends DogBehavior{
	var target:GameObject;
	var targetIndex: int; // Unity Arrays don't have a 'remove' function, only removeAt
	function DogGetDuck(targetIndex:int){
		this.targetIndex = targetIndex;
		this.target = (DuckSpawner.ducks[targetIndex] as Transform).gameObject;
	}
	
	function getMove(){
		var diff = target.transform.position - owner.transform.position;
		var move = Vector3.Normalize(diff) * owner.speed * Time.deltaTime;
		
		move.y = 0;
		return move;
	}
	
	function checkState(){
		if (Vector3.Distance(owner.transform.position, target.transform.position) < 1.8){
			owner.setBehavior(new DogPresentDuck(targetIndex));
		}
	}
	
	function drawGizmos(){
		Gizmos.color = Color.blue;
		Gizmos.DrawLine(owner.transform.position, target.transform.position);
	}
}

// The dog has caught up to the duck, time to feast!
// Transitions to:
//    DogHuntPlayer -- Once it's done eating, time to get back to the hunt
class DogPresentDuck extends DogBehavior{
	var target:GameObject;
	var targetIndex:int;
	
	var timeLeft = 2.0;
	
	var soundPlayed = false;
	function DogPresentDuck(targetIndex:int){
		this.targetIndex = targetIndex;
		this.target = (DuckSpawner.ducks[targetIndex] as Transform).gameObject;
	}
	
	function getMove(){
		if(!soundPlayed){
			soundPlayed = true;
			owner.audio.PlayOneShot(owner.presentSound);
		}
		// Bob up out of the grass, showing our grisly duck trophy!
		// We're so proud of you, dog!
		timeLeft -= Time.deltaTime;
		
		return Vector3.zero;
	}
	
	function checkState(){
		if (timeLeft < 0){
			owner.setBehavior(new DogHuntPlayer());
			DuckSpawner.ducks.RemoveAt(targetIndex);
			UnityEngine.Object.Destroy(target); // This took a while to find :(
		}
	}
}

// The dog pauses to pounce on the player
class DogPrepareToAttack extends DogBehavior{
	var soundPlayed = false;
	var timeLeft = 1.0;
	
	function getMove(){
		if(!soundPlayed){
			soundPlayed = true;
			owner.audio.PlayOneShot(owner.announceSound);
		}
		
		timeLeft -= Time.deltaTime;
	}
	
	function checkState(){
		if (timeLeft < 0){
			owner.setBehavior(new DogLaunch());
		}
	}
}

class DogLaunch extends DogBehavior{
	var hasLaunched = false;
	var timeLeft = 1.0;
	
	function getMove(){
		if (!hasLaunched){
			hasLaunched = true;
			owner.rigidbody.useGravity = true;
			var diff = owner.player.transform.position - owner.transform.position;
			diff.y = owner.player.transform.position.y + 1;
			
			diff = Vector3.Normalize(diff);
			
			owner.rigidbody.AddForce(diff*2000);
		}
		else {
			timeLeft -= Time.deltaTime;
		}
	}
	
	function checkState(){
		if (timeLeft < 0){
			var groundRay = new Ray(owner.transform.position, Vector3.down);
			var groundRayHit: RaycastHit;
			
			if (Physics.Raycast(groundRay, groundRayHit, .5)){
				owner.setBehavior(new DogHuntPlayer());
				owner.rigidbody.velocity = Vector3.zero;
			}
		}
	}
}